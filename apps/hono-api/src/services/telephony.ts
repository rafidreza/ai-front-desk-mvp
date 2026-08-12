import { and, desc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { calls, tenantPhoneNumbers } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Telephony ingress control/data plane (T1).
 *
 * Responsibilities that live here (Hono API):
 *  - map a dialled number -> exactly one clientId (tenant resolution), with NO fallback tenant;
 *  - create/update/finalise the Call record, tenant-scoped.
 *
 * NOT here (voice runtime, needs a long-lived Pipecat host — see PRD T1/T2): accepting the SIP/
 * forwarded audio, opening the media session, recording capture. That runtime calls this plane
 * to resolve the tenant and open/close the call record.
 *
 * TELCO PARKED (2026-07-28) — read before editing.
 * The product's live call path is the web widget (browser WebRTC), not PSTN. The phone-only
 * members below are marked `@parked`; their HTTP routes are commented out in routes/voice.ts.
 * They are deliberately NOT deleted:
 *   - `CallService` is shared — `startSession` (web widget) lives on the same class, and the
 *     constructor takes the phone-number service;
 *   - `TenantPhoneNumberService` is also a dependency of `OnboardingService`;
 *   - both are covered by test/telephony.spec.ts, which still passes.
 * There is no vendor SDK anywhere in this file, so nothing here is coupled to Twilio or any
 * other carrier — restoring the phone path means restoring routes, not rewriting this.
 */

export type CallStatus = 'ringing' | 'active' | 'ended' | 'failed';

export type CallEventType = 'call.started' | 'call.ended' | 'call.failed';

export type CallEvent = {
  type: CallEventType;
  clientId: string;
  callId: string;
  at: Date;
};

/** Sink for lifecycle events (consumed later by T10 console + T27 audit). Defaults to no-op. */
export type CallEventSink = (event: CallEvent) => void | Promise<void>;

export class CallRoutingError extends Error {
  constructor(dialledNumber: string) {
    super(`No client is mapped to dialled number ${dialledNumber}; call rejected (no fallback tenant).`);
    this.name = 'CallRoutingError';
  }
}

/**
 * Normalise a phone number to a simple E.164-ish form: keep a leading '+', strip everything that
 * is not a digit. This is intentionally minimal for the MVP; swap in a real libphonenumber pass
 * (region-aware) before production. The invariant callers rely on: the same physical number
 * always normalises to the same string, so mapping + lookup agree.
 */
export function normalizeE164(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) {
    throw new Error('A phone number with at least one digit is required.');
  }
  return `${hasPlus ? '+' : ''}${digits}`;
}

/**
 * Manages the number -> client mapping that makes inbound calls tenant-scoped.
 * @parked Phone-only. Still constructed (OnboardingService + CallService depend on it), but no
 * live route reaches it while the telco path is parked.
 */
export class TenantPhoneNumberService {
  constructor(private readonly db: AppDb) {}

  /** Register (or re-point) a number to a client. Mapping is unique per number. */
  async register(ctx: TenantContext, input: { e164Number: string; label?: string }) {
    const clientId = assertClientId(ctx.clientId);
    const e164 = normalizeE164(input.e164Number);
    const now = new Date();
    const [row] = await this.db
      .insert(tenantPhoneNumbers)
      .values({
        id: randomId('tpn-'),
        clientId,
        e164Number: e164,
        label: input.label,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tenantPhoneNumbers.e164Number,
        set: { clientId, label: input.label, active: true, updatedAt: now },
      })
      .returning();
    return row!;
  }

  /**
   * Resolve a dialled number to its owning clientId. Returns null when unmapped/inactive — the
   * caller MUST reject rather than fall back to any default tenant.
   */
  async resolveClientByDialledNumber(dialledNumber: string): Promise<{ clientId: string; phoneNumberId: string } | null> {
    const e164 = normalizeE164(dialledNumber);
    const [row] = await this.db
      .select({ id: tenantPhoneNumbers.id, clientId: tenantPhoneNumbers.clientId })
      .from(tenantPhoneNumbers)
      .where(and(eq(tenantPhoneNumbers.e164Number, e164), eq(tenantPhoneNumbers.active, true)))
      .limit(1);
    if (row === undefined) return null;
    return { clientId: row.clientId, phoneNumberId: row.id };
  }

  /** List a tenant's numbers. */
  async list(ctx: TenantContext) {
    return this.db
      .select()
      .from(tenantPhoneNumbers)
      .where(tenantScope(tenantPhoneNumbers.clientId, ctx))
      .orderBy(desc(tenantPhoneNumbers.createdAt));
  }
}

/** Creates and updates Call records over the call lifecycle, tenant-scoped throughout. */
export class CallService {
  constructor(
    private readonly db: AppDb,
    private readonly phoneNumbers: TenantPhoneNumberService,
    private readonly emit: CallEventSink = () => {},
  ) {}

  /**
   * Answer an inbound call: resolve the tenant from the dialled number, then create the call
   * record. Throws CallRoutingError for an unmapped number — never assigns a default tenant.
   * @parked Phone-only; its route is commented out in routes/voice.ts. The live equivalent for
   * the web widget is `startSession` below.
   */
  async startInboundCall(input: {
    dialledNumber: string;
    callerIdMasked?: string;
    languagePosture?: string;
  }) {
    const resolved = await this.phoneNumbers.resolveClientByDialledNumber(input.dialledNumber);
    if (resolved === null) {
      throw new CallRoutingError(input.dialledNumber);
    }
    const ctx: TenantContext = { clientId: resolved.clientId };
    const now = new Date();
    const [call] = await this.db
      .insert(calls)
      .values(
        tenantValues(ctx, {
          id: randomId('call-'),
          phoneNumberId: resolved.phoneNumberId,
          dialledNumber: normalizeE164(input.dialledNumber),
          callerIdMasked: input.callerIdMasked,
          direction: 'inbound',
          status: 'ringing' as CallStatus,
          languagePosture: input.languagePosture,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      )
      .returning();
    await this.emit({ type: 'call.started', clientId: resolved.clientId, callId: call!.id, at: now });
    return call!;
  }

  /**
   * Start a call for an already-resolved tenant (no dialled-number lookup). Used by the browser/
   * web-mic session and anywhere the clientId is already known. Creates an active call record.
   */
  async startSession(ctx: TenantContext, input: { callerIdMasked?: string; languagePosture?: string } = {}) {
    const clientId = assertClientId(ctx.clientId);
    const now = new Date();
    const [call] = await this.db
      .insert(calls)
      .values(
        tenantValues(ctx, {
          id: randomId('call-'),
          dialledNumber: 'web-session',
          callerIdMasked: input.callerIdMasked,
          direction: 'inbound',
          status: 'active' as CallStatus,
          languagePosture: input.languagePosture,
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      )
      .returning();
    await this.emit({ type: 'call.started', clientId, callId: call!.id, at: now });
    return call!;
  }

  /** Update call status (e.g. ringing -> active). Tenant-scoped. */
  async updateStatus(ctx: TenantContext, callId: string, status: CallStatus) {
    const [call] = await this.db
      .update(calls)
      .set({ status, updatedAt: new Date() })
      .where(tenantScope(calls.clientId, ctx, eq(calls.id, callId)))
      .returning();
    return call ?? null;
  }

  /** Close out a call: set end status, reason, duration, recording. Emits ended/failed. */
  async finalize(
    ctx: TenantContext,
    callId: string,
    input: { status: 'ended' | 'failed'; endReason?: string; recordingUrl?: string; outcome?: string },
  ) {
    const clientId = assertClientId(ctx.clientId);
    const endedAt = new Date();
    const [existing] = await this.db
      .select({ startedAt: calls.startedAt })
      .from(calls)
      .where(tenantScope(calls.clientId, ctx, eq(calls.id, callId)))
      .limit(1);
    if (existing === undefined) return null;
    const durationS = Math.max(0, Math.round((endedAt.getTime() - existing.startedAt.getTime()) / 1000));
    const [call] = await this.db
      .update(calls)
      .set({
        status: input.status,
        endReason: input.endReason,
        recordingUrl: input.recordingUrl,
        outcome: input.outcome,
        durationS,
        endedAt,
        updatedAt: endedAt,
      })
      .where(tenantScope(calls.clientId, ctx, eq(calls.id, callId)))
      .returning();
    await this.emit({
      type: input.status === 'failed' ? 'call.failed' : 'call.ended',
      clientId,
      callId,
      at: endedAt,
    });
    return call ?? null;
  }

  /** Fetch one call, tenant-scoped. */
  async get(ctx: TenantContext, callId: string) {
    const [call] = await this.db
      .select()
      .from(calls)
      .where(tenantScope(calls.clientId, ctx, eq(calls.id, callId)))
      .limit(1);
    return call ?? null;
  }

  /** List a tenant's calls, newest first. */
  async list(ctx: TenantContext) {
    return this.db
      .select()
      .from(calls)
      .where(tenantScope(calls.clientId, ctx))
      .orderBy(desc(calls.startedAt));
  }
}
