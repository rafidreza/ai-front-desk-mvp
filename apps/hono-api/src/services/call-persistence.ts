import { asc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { callActions, calls, transcriptSegments } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Call persistence: transcript + actions (T4).
 *
 * The durable memory of a call. T2 streams turn events in during the call; this service persists
 * them as diarized transcript segments (idempotent by turn index, so a retried write refines
 * rather than duplicates) and records any actions invoked. All reads/writes are tenant-scoped.
 *
 * Storage schema only — meaning extraction (T3), scoring (T13), and groundedness (T14) read from
 * here; they do not live here.
 */

export type Speaker = 'caller' | 'ai' | 'human';

export type ActionClass = 'read' | 'reversible_write' | 'irreversible_financial';

export type TranscriptTurn = {
  callId: string;
  turnIndex: number;
  speaker: Speaker;
  text: string;
  language?: string;
  latencyMs?: number;
  startedAt?: Date;
  endedAt?: Date;
};

export type CallActionInput = {
  callId: string;
  type: string;
  actionClass: ActionClass;
  turnIndex?: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  approvedBy?: string;
};

export class CallPersistenceService {
  constructor(private readonly db: AppDb) {}

  /**
   * Append or refine one transcript turn. Idempotent by (callId, turnIndex): a retry with the
   * same turn index updates the existing row instead of creating a duplicate — so a mid-call
   * failure/replay never doubles the transcript.
   */
  async persistTurn(ctx: TenantContext, turn: TranscriptTurn) {
    const clientId = assertClientId(ctx.clientId);
    const [row] = await this.db
      .insert(transcriptSegments)
      .values(
        tenantValues(ctx, {
          id: randomId('seg-'),
          callId: turn.callId,
          turnIndex: turn.turnIndex,
          speaker: turn.speaker,
          text: turn.text,
          language: turn.language,
          latencyMs: turn.latencyMs,
          startedAt: turn.startedAt,
          endedAt: turn.endedAt,
          createdAt: new Date(),
        }),
      )
      .onConflictDoUpdate({
        target: [transcriptSegments.callId, transcriptSegments.turnIndex],
        set: {
          speaker: turn.speaker,
          text: turn.text,
          language: turn.language,
          latencyMs: turn.latencyMs,
          startedAt: turn.startedAt,
          endedAt: turn.endedAt,
        },
      })
      .returning();
    // Guard: onConflict rows must belong to this tenant (defence in depth against a mismatched
    // callId being claimed under the wrong clientId).
    if (row !== undefined && row.clientId !== clientId) {
      throw new Error('Transcript segment tenant mismatch.');
    }
    return row!;
  }

  /** Record an action invoked during a call (append-only). */
  async recordAction(ctx: TenantContext, action: CallActionInput) {
    assertClientId(ctx.clientId);
    const [row] = await this.db
      .insert(callActions)
      .values(
        tenantValues(ctx, {
          id: randomId('act-'),
          callId: action.callId,
          turnIndex: action.turnIndex,
          type: action.type,
          actionClass: action.actionClass,
          payload: action.payload ?? {},
          result: action.result ?? null,
          approvedBy: action.approvedBy,
          at: new Date(),
        }),
      )
      .returning();
    return row!;
  }

  /** All transcript segments for a call, in turn order. Tenant-scoped. */
  async listTranscript(ctx: TenantContext, callId: string) {
    return this.db
      .select()
      .from(transcriptSegments)
      .where(tenantScope(transcriptSegments.clientId, ctx, eq(transcriptSegments.callId, callId)))
      .orderBy(asc(transcriptSegments.turnIndex));
  }

  /** All actions for a call, in time order. Tenant-scoped. */
  async listActions(ctx: TenantContext, callId: string) {
    return this.db
      .select()
      .from(callActions)
      .where(tenantScope(callActions.clientId, ctx, eq(callActions.callId, callId)))
      .orderBy(asc(callActions.at));
  }

  /** The call record plus its transcript and actions, tenant-scoped. Null if the call is absent. */
  async getCallWithTranscript(ctx: TenantContext, callId: string) {
    const [call] = await this.db
      .select()
      .from(calls)
      .where(tenantScope(calls.clientId, ctx, eq(calls.id, callId)))
      .limit(1);
    if (call === undefined) return null;
    const [transcript, actions] = await Promise.all([
      this.listTranscript(ctx, callId),
      this.listActions(ctx, callId),
    ]);
    return { call, transcript, actions };
  }
}
