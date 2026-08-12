import { asc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { escalations } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Escalation trigger -> human (T8).
 *
 * Decides WHEN the AI should hand a caller to a human anchor, and packages the full context so the
 * human takes over with "thirty seconds of context, zero re-explaining." Fires on the situations
 * only a human should own. MVP hand-off is async callback / queued pickup; live warm transfer is
 * T11 (deferred). Escalations land in the owning tenant's Anchor Console queue (T10).
 */

export type EscalationSignals = {
  grounded?: boolean; // from T14 — false => ungrounded answer
  outOfKb?: boolean; // from T5 — question not in KB
  explicitRequest?: boolean; // caller asked for a person
  qualifiedNeedsHuman?: boolean; // from T7 — qualified lead needing negotiation
  repeatedFailureCount?: number; // repeated confusion/failed turns
  customTriggers?: string[]; // per-tenant custom triggers already evaluated to fired names
};

export type EscalationDecision =
  | { escalate: false }
  | { escalate: true; reason: string };

/** Pure decision. Priority order is fixed; the first matching signal wins the reason. */
export function evaluateEscalation(signals: EscalationSignals, opts: { maxFailures?: number } = {}): EscalationDecision {
  const maxFailures = opts.maxFailures ?? 2;
  if (signals.explicitRequest) return { escalate: true, reason: 'explicit_request' };
  if (signals.grounded === false) return { escalate: true, reason: 'ungrounded_answer' };
  if (signals.outOfKb) return { escalate: true, reason: 'out_of_kb' };
  if (signals.qualifiedNeedsHuman) return { escalate: true, reason: 'qualified_lead' };
  if ((signals.repeatedFailureCount ?? 0) >= maxFailures) return { escalate: true, reason: 'repeated_failure' };
  if (signals.customTriggers && signals.customTriggers.length > 0) {
    return { escalate: true, reason: `custom:${signals.customTriggers[0]}` };
  }
  return { escalate: false };
}

export type EscalationEvent = { type: 'escalation.created'; clientId: string; escalationId: string; reason: string };
export type EscalationEventSink = (event: EscalationEvent) => void | Promise<void>;

export class EscalationService {
  constructor(
    private readonly db: AppDb,
    private readonly emit: EscalationEventSink = () => {},
  ) {}

  /** Raise an escalation into the tenant's queue with a full context payload. */
  async raise(
    ctx: TenantContext,
    input: {
      reason: string;
      threadId?: string;
      callId?: string;
      mode?: 'async' | 'queued';
      payload?: Record<string, unknown>;
    },
  ) {
    const clientId = assertClientId(ctx.clientId);
    const [row] = await this.db
      .insert(escalations)
      .values(
        tenantValues(ctx, {
          id: randomId('esc-'),
          threadId: input.threadId,
          callId: input.callId,
          reason: input.reason,
          mode: input.mode ?? 'async',
          status: 'open',
          payload: input.payload ?? {},
          createdAt: new Date(),
        }),
      )
      .returning();
    await this.emit({ type: 'escalation.created', clientId, escalationId: row!.id, reason: input.reason });
    return row!;
  }

  /** Evaluate signals and, if escalation is warranted, raise it. Returns the decision + row. */
  async evaluateAndRaise(
    ctx: TenantContext,
    signals: EscalationSignals,
    context: { threadId?: string; callId?: string; mode?: 'async' | 'queued'; payload?: Record<string, unknown> },
  ) {
    const decision = evaluateEscalation(signals);
    if (!decision.escalate) return { decision };
    const row = await this.raise(ctx, { reason: decision.reason, ...context });
    return { decision, escalation: row };
  }

  /** The open escalation queue for a tenant, oldest first. */
  async listOpen(ctx: TenantContext) {
    return this.db
      .select()
      .from(escalations)
      .where(tenantScope(escalations.clientId, ctx, eq(escalations.status, 'open')))
      .orderBy(asc(escalations.createdAt));
  }

  /** An operator takes an escalation. */
  async take(ctx: TenantContext, escalationId: string, operatorId: string) {
    const [row] = await this.db
      .update(escalations)
      .set({ status: 'taken', assignedTo: operatorId })
      .where(tenantScope(escalations.clientId, ctx, eq(escalations.id, escalationId)))
      .returning();
    return row ?? null;
  }

  /** Resolve an escalation. */
  async resolve(ctx: TenantContext, escalationId: string) {
    const [row] = await this.db
      .update(escalations)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(tenantScope(escalations.clientId, ctx, eq(escalations.id, escalationId)))
      .returning();
    return row ?? null;
  }
}
