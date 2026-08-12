import { and, asc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { connectorWriteQueue, connectors } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';
import type { TenantSecretsService } from './tenant-secrets';

/**
 * Connector framework (T24).
 *
 * The generic, tenant-scoped way to talk to a client's external systems as SIDE EFFECTS — never
 * the system of record. Two guarantees the vision doc requires (Step 10):
 *   - reads that fail return `unknown` (never a fabricated value);
 *   - writes that fail are QUEUED and replayed on recovery, so a call never halts.
 *
 * Credentials are NOT stored here — config references a TenantSecret key (T26), resolved per call
 * by the owning clientId. All connector invocations are expected to be classified + audited by the
 * governance layer (T9) that wraps this service.
 */

export type ConnectorReadStatus = 'found' | 'not_found' | 'unknown';
export type ConnectorReadResult<T = unknown> = {
  status: ConnectorReadStatus;
  data?: T;
  error?: string;
};

export type ConnectorWriteStatus = 'applied' | 'queued' | 'failed';
export type ConnectorWriteResult = {
  status: ConnectorWriteStatus;
  data?: unknown;
  error?: string;
};

/** A concrete integration. Implementations must never throw for expected failures — they return a
 *  typed result so the framework can degrade gracefully. */
export interface Connector {
  readonly type: string;
  read(query: Record<string, unknown>): Promise<ConnectorReadResult>;
  write(op: Record<string, unknown>): Promise<ConnectorWriteResult>;
}

export type HttpConnectorConfig = {
  baseUrl: string;
  readPath?: string;
  writePath?: string;
  method?: string;
  headers?: Record<string, string>;
  authHeader?: string; // e.g. 'Authorization'
  timeoutMs?: number;
};

/** Generic HTTP connector — covers the pilot without bespoke code. Auth token (if any) is passed
 *  in already-resolved from the tenant's secret store; this class never reads secrets itself. */
export class HttpConnector implements Connector {
  readonly type: string;

  constructor(
    type: string,
    private readonly config: HttpConnectorConfig,
    private readonly authToken?: string,
  ) {
    this.type = type;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...this.config.headers };
    if (this.authToken !== undefined && this.config.authHeader !== undefined) {
      headers[this.config.authHeader] = this.authToken;
    }
    return headers;
  }

  private async fetchJson(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; body: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { ok: response.ok, status: response.status, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  async read(query: Record<string, unknown>): Promise<ConnectorReadResult> {
    try {
      const url = new URL(this.config.readPath ?? '', this.config.baseUrl);
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
      }
      const { ok, status, body } = await this.fetchJson(url.toString(), { method: 'GET', headers: this.headers() });
      if (!ok) {
        return status === 404 ? { status: 'not_found' } : { status: 'unknown', error: `HTTP ${status}` };
      }
      return { status: 'found', data: body };
    } catch (error) {
      return { status: 'unknown', error: error instanceof Error ? error.message : 'read failed' };
    }
  }

  async write(op: Record<string, unknown>): Promise<ConnectorWriteResult> {
    const url = new URL(this.config.writePath ?? '', this.config.baseUrl);
    const { ok, status, body } = await this.fetchJson(url.toString(), {
      method: this.config.method ?? 'POST',
      headers: this.headers(),
      body: JSON.stringify(op),
    });
    if (!ok) {
      // Throw so the framework treats it as a failure to queue+replay.
      throw new Error(`connector write failed: HTTP ${status}`);
    }
    return { status: 'applied', data: body };
  }
}

/** Builds a Connector from stored tenant config. Swappable per type; default is HTTP. */
export type ConnectorFactory = (input: {
  type: string;
  config: Record<string, unknown>;
  authToken?: string;
}) => Connector;

const defaultFactory: ConnectorFactory = ({ type, config, authToken }) =>
  new HttpConnector(type, config as HttpConnectorConfig, authToken);

export class ConnectorFrameworkService {
  constructor(
    private readonly db: AppDb,
    private readonly secrets: TenantSecretsService,
    private readonly factory: ConnectorFactory = defaultFactory,
  ) {}

  /** Register (or update) a connector for a tenant. */
  async register(ctx: TenantContext, input: { type: string; config: Record<string, unknown> }) {
    const clientId = assertClientId(ctx.clientId);
    const now = new Date();
    const [row] = await this.db
      .insert(connectors)
      .values({ id: randomId('con-'), clientId, type: input.type, config: input.config, status: 'active', createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: [connectors.clientId, connectors.type], set: { config: input.config, status: 'active', updatedAt: now } })
      .returning();
    return row!;
  }

  private async build(ctx: TenantContext, type: string): Promise<Connector | null> {
    const [row] = await this.db
      .select({ config: connectors.config, status: connectors.status })
      .from(connectors)
      .where(tenantScope(connectors.clientId, ctx, eq(connectors.type, type)))
      .limit(1);
    if (row === undefined || row.status !== 'active') return null;
    const config = row.config;
    const authSecretKey = typeof config.authSecretKey === 'string' ? config.authSecretKey : undefined;
    const authToken = authSecretKey !== undefined ? (await this.secrets.get(ctx, authSecretKey)) ?? undefined : undefined;
    return this.factory({ type, config, authToken });
  }

  /**
   * Read via a tenant's connector. Graceful: a missing/failing connector returns `unknown`
   * (never a fabricated value) so the caller can hedge/escalate.
   */
  async read(ctx: TenantContext, type: string, query: Record<string, unknown>): Promise<ConnectorReadResult> {
    assertClientId(ctx.clientId);
    const connector = await this.build(ctx, type);
    if (connector === null) return { status: 'unknown', error: 'connector not configured' };
    return connector.read(query);
  }

  /**
   * Write via a tenant's connector. On failure the write is QUEUED for replay and the call
   * continues. Idempotency key prevents double-apply on replay.
   */
  async write(
    ctx: TenantContext,
    type: string,
    op: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ConnectorWriteResult> {
    assertClientId(ctx.clientId);
    const [connectorRow] = await this.db
      .select({ id: connectors.id, status: connectors.status })
      .from(connectors)
      .where(tenantScope(connectors.clientId, ctx, eq(connectors.type, type)))
      .limit(1);
    if (connectorRow === undefined) return { status: 'failed', error: 'connector not configured' };

    const connector = await this.build(ctx, type);
    if (connector === null) return { status: 'failed', error: 'connector inactive' };

    try {
      return await connector.write(op);
    } catch (error) {
      await this.enqueueWrite(ctx, connectorRow.id, idempotencyKey, op, error instanceof Error ? error.message : 'write failed');
      return { status: 'queued', error: error instanceof Error ? error.message : 'write failed' };
    }
  }

  /** Queue a failed write for later replay (idempotent per connector+key). */
  private async enqueueWrite(
    ctx: TenantContext,
    connectorId: string,
    idempotencyKey: string,
    payload: Record<string, unknown>,
    lastError: string,
  ) {
    const now = new Date();
    await this.db
      .insert(connectorWriteQueue)
      .values(
        tenantValues(ctx, {
          id: randomId('cwq-'),
          connectorId,
          idempotencyKey,
          payload,
          status: 'pending',
          attempts: 0,
          lastError,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      )
      .onConflictDoNothing({ target: [connectorWriteQueue.connectorId, connectorWriteQueue.idempotencyKey] });
  }

  /** Pending queued writes for a tenant (for the replay worker / console visibility). */
  async listPendingWrites(ctx: TenantContext) {
    return this.db
      .select()
      .from(connectorWriteQueue)
      .where(tenantScope(connectorWriteQueue.clientId, ctx, eq(connectorWriteQueue.status, 'pending')))
      .orderBy(asc(connectorWriteQueue.createdAt));
  }

  /**
   * Attempt to replay a tenant's pending writes. Returns counts. A full durable scheduler/backoff
   * is T25's job; this is the minimal recover-on-demand path for MVP.
   */
  async replayPending(ctx: TenantContext): Promise<{ replayed: number; stillPending: number }> {
    const pending = await this.listPendingWrites(ctx);
    let replayed = 0;
    for (const entry of pending) {
      const connector = await this.buildById(ctx, entry.connectorId);
      if (connector === null) continue;
      try {
        await connector.write(entry.payload);
        await this.db
          .update(connectorWriteQueue)
          .set({ status: 'replayed', attempts: entry.attempts + 1, updatedAt: new Date() })
          .where(and(eq(connectorWriteQueue.id, entry.id), eq(connectorWriteQueue.clientId, assertClientId(ctx.clientId))));
        replayed += 1;
      } catch (error) {
        await this.db
          .update(connectorWriteQueue)
          .set({ attempts: entry.attempts + 1, lastError: error instanceof Error ? error.message : 'replay failed', updatedAt: new Date() })
          .where(and(eq(connectorWriteQueue.id, entry.id), eq(connectorWriteQueue.clientId, assertClientId(ctx.clientId))));
      }
    }
    return { replayed, stillPending: pending.length - replayed };
  }

  private async buildById(ctx: TenantContext, connectorId: string): Promise<Connector | null> {
    const [row] = await this.db
      .select({ type: connectors.type, config: connectors.config, status: connectors.status })
      .from(connectors)
      .where(tenantScope(connectors.clientId, ctx, eq(connectors.id, connectorId)))
      .limit(1);
    if (row === undefined || row.status !== 'active') return null;
    const authSecretKey = typeof row.config.authSecretKey === 'string' ? row.config.authSecretKey : undefined;
    const authToken = authSecretKey !== undefined ? (await this.secrets.get(ctx, authSecretKey)) ?? undefined : undefined;
    return this.factory({ type: row.type, config: row.config, authToken });
  }
}
