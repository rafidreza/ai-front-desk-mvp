import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { threadStateFieldSchemas, threadStates, threads } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Structured thread state (T3).
 *
 * Turns a conversation into typed fields on the customer's thread, so a later step (sales,
 * finance, a human) picks up with zero re-explaining. This service owns the storage + the
 * deterministic merge. The *extraction* (transcript -> field patch) is LLM-backed and injected
 * as a StateExtractor — the real impl arrives with the voice loop (T2/T5); the default is a
 * no-op so the data plane is testable now.
 */

/** A single field value with optional confidence/provenance. Low confidence => treat as a flag. */
export type FieldValue = {
  value: unknown;
  confidence?: number;
  source?: string;
};

export type ThreadFields = Record<string, FieldValue>;

/** Merge a patch onto existing fields. Patch wins per-field; untouched fields are preserved.
 *  Pure + idempotent: applying the same patch twice yields the same result. */
export function mergeThreadFields(existing: ThreadFields, patch: ThreadFields): ThreadFields {
  return { ...existing, ...patch };
}

/** Flatten to plain field -> value (drops confidence/source), for downstream logic. */
export function flattenValues(fields: ThreadFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(fields)) {
    out[key] = entry.value;
  }
  return out;
}

/** Field keys whose confidence is below the threshold (or unknown) — surfaced as flags. */
export function lowConfidenceFields(fields: ThreadFields, threshold = 0.6): string[] {
  return Object.entries(fields)
    .filter(([, entry]) => entry.confidence === undefined || entry.confidence < threshold)
    .map(([key]) => key);
}

/** Interface for turning conversation into a field patch. Swappable; default is a no-op. */
export interface StateExtractor {
  extract(input: { clientId: string; transcriptSoFar: string; currentFields: ThreadFields }): Promise<ThreadFields>;
}

export class NoopStateExtractor implements StateExtractor {
  async extract(): Promise<ThreadFields> {
    return {};
  }
}

export class ThreadStateService {
  constructor(
    private readonly db: AppDb,
    private readonly extractor: StateExtractor = new NoopStateExtractor(),
  ) {}

  /** Load or create the thread for a caller identity (phone number for MVP). Bumps lastSeenAt. */
  async getOrCreateThread(ctx: TenantContext, identity: string) {
    const clientId = assertClientId(ctx.clientId);
    const normalizedIdentity = identity.trim();
    if (normalizedIdentity.length === 0) {
      throw new Error('A non-empty thread identity is required.');
    }
    const now = new Date();
    const [thread] = await this.db
      .insert(threads)
      .values({
        id: randomId('thr-'),
        clientId,
        identity: normalizedIdentity,
        createdAt: now,
        lastSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [threads.clientId, threads.identity],
        set: { lastSeenAt: now, updatedAt: now },
      })
      .returning();
    return thread!;
  }

  /** Current structured fields for a thread. Empty object when no state has been captured yet. */
  async getThreadState(ctx: TenantContext, threadId: string): Promise<ThreadFields> {
    const [row] = await this.db
      .select({ fields: threadStates.fields })
      .from(threadStates)
      .where(tenantScope(threadStates.clientId, ctx, eq(threadStates.threadId, threadId)))
      .limit(1);
    return (row?.fields as ThreadFields | undefined) ?? {};
  }

  /** Merge a field patch onto a thread's state (idempotent). Creates the state row on first use. */
  async applyStatePatch(ctx: TenantContext, threadId: string, patch: ThreadFields): Promise<ThreadFields> {
    assertClientId(ctx.clientId);
    const existing = await this.getThreadState(ctx, threadId);
    const merged = mergeThreadFields(existing, patch);
    const now = new Date();
    await this.db
      .insert(threadStates)
      .values(
        tenantValues(ctx, {
          id: randomId('tst-'),
          threadId,
          fields: merged as Record<string, unknown>,
          updatedAt: now,
        }),
      )
      .onConflictDoUpdate({
        target: threadStates.threadId,
        set: { fields: merged as Record<string, unknown>, updatedAt: now },
      });
    return merged;
  }

  /** Extract a patch from the conversation so far and apply it. Convenience for the voice loop. */
  async extractAndApply(ctx: TenantContext, threadId: string, transcriptSoFar: string): Promise<ThreadFields> {
    const clientId = assertClientId(ctx.clientId);
    const currentFields = await this.getThreadState(ctx, threadId);
    const patch = await this.extractor.extract({ clientId, transcriptSoFar, currentFields });
    if (Object.keys(patch).length === 0) return currentFields;
    return this.applyStatePatch(ctx, threadId, patch);
  }

  /** Per-tenant field schema (which fields this client captures). Empty array if unset. */
  async getFieldSchema(ctx: TenantContext): Promise<Record<string, unknown>[]> {
    const [row] = await this.db
      .select({ schema: threadStateFieldSchemas.schema })
      .from(threadStateFieldSchemas)
      .where(tenantScope(threadStateFieldSchemas.clientId, ctx))
      .limit(1);
    return row?.schema ?? [];
  }

  /** Set the per-tenant field schema. */
  async setFieldSchema(ctx: TenantContext, schema: Record<string, unknown>[]): Promise<void> {
    const clientId = assertClientId(ctx.clientId);
    const now = new Date();
    await this.db
      .insert(threadStateFieldSchemas)
      .values({ id: randomId('tfs-'), clientId, schema, updatedAt: now })
      .onConflictDoUpdate({ target: threadStateFieldSchemas.clientId, set: { schema, updatedAt: now } });
  }
}
