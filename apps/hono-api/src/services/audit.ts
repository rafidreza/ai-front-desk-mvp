import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { auditEvents } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Governance / audit log (T27).
 *
 * The append-only, tenant-scoped "who did what, when, and why" trail. This is not analytics — it's
 * the immutable record needed for trust, disputes, and compliance. Entries are never updated or
 * deleted here (retention-driven redaction is a separate, deliberate job).
 *
 * Written by nearly everything: call lifecycle (T1), actions + class (T9), approvals, escalations
 * (T8), groundedness verdicts (T14), config changes (T12). The write is async/fire-and-forget from
 * callers so it never slows a live call.
 */

export type AuditActorType = 'system' | 'ai' | 'operator';

export type AuditRecordInput = {
  actorType: AuditActorType;
  actorId?: string;
  eventType: string;
  payload?: Record<string, unknown>;
};

export class AuditService {
  constructor(private readonly db: AppDb) {}

  /** Append one audit entry (tenant-scoped). */
  async record(ctx: TenantContext, input: AuditRecordInput): Promise<void> {
    assertClientId(ctx.clientId);
    await this.db.insert(auditEvents).values(
      tenantValues(ctx, {
        id: randomId('aud-'),
        actorType: input.actorType,
        actorId: input.actorId,
        eventType: input.eventType,
        payload: input.payload ?? {},
        createdAt: new Date(),
      }),
    );
  }

  /** Query the audit trail for a tenant, newest first. */
  async list(
    ctx: TenantContext,
    filters: { eventType?: string; actorId?: string; from?: Date; to?: Date; limit?: number } = {},
  ) {
    const conditions = [
      filters.eventType ? eq(auditEvents.eventType, filters.eventType) : undefined,
      filters.actorId ? eq(auditEvents.actorId, filters.actorId) : undefined,
      filters.from ? gte(auditEvents.createdAt, filters.from) : undefined,
      filters.to ? lte(auditEvents.createdAt, filters.to) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    return this.db
      .select()
      .from(auditEvents)
      .where(tenantScope(auditEvents.clientId, ctx, and(...conditions)))
      .orderBy(desc(auditEvents.createdAt))
      .limit(filters.limit ?? 200);
  }
}
