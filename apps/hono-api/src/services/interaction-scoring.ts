import { asc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { callScores, calls, groundednessVerdicts, transcriptSegments } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Interaction scoring (T13) — the MVP slice of Assurance.
 *
 * Scores EVERY completed call against a small rubric (greeting, closing, groundedness) instead of a
 * ~2% human sample, and flags low-scoring calls for human review (T10). Deterministic default so it
 * runs without keys; an LLM-judge can extend the rubric behind the same shape later. Groundedness
 * (T14) verdicts feed the score directly.
 */

export type RubricInput = {
  firstAiText?: string;
  lastAiText?: string;
  verdicts: { verdict: string }[];
};

export type ScoreBreakdown = { greeting: number; closing: number; groundedness: number };

export type CallScoreResult = { score: number; breakdown: ScoreBreakdown; flagged: boolean };

const GREETING_TERMS = ['hello', 'hi ', 'assalamu', 'salam', 'welcome', 'good morning', 'good afternoon'];
const CLOSING_TERMS = ['thank', 'thanks', 'bye', 'welcome', 'dhonnobad', 'ধন্যবাদ', 'have a good'];

function containsAny(text: string | undefined, terms: string[]): boolean {
  if (text === undefined) return false;
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

/** Pure rubric scoring out of 100: greeting 20, closing 20, groundedness 60. */
export function scoreRubric(input: RubricInput, opts: { flagThreshold?: number } = {}): CallScoreResult {
  const flagThreshold = opts.flagThreshold ?? 70;
  const greeting = containsAny(input.firstAiText, GREETING_TERMS) ? 20 : 0;
  const closing = containsAny(input.lastAiText, CLOSING_TERMS) ? 20 : 0;

  let groundedness = 60;
  if (input.verdicts.length > 0) {
    const grounded = input.verdicts.filter((v) => v.verdict === 'grounded').length;
    groundedness = Math.round((grounded / input.verdicts.length) * 60);
  }
  const score = greeting + closing + groundedness;
  return { score, breakdown: { greeting, closing, groundedness }, flagged: score < flagThreshold };
}

export class InteractionScoringService {
  constructor(private readonly db: AppDb) {}

  /** Score a completed call and persist the result. Runs post-call (async is fine). */
  async scoreCall(ctx: TenantContext, callId: string): Promise<CallScoreResult> {
    assertClientId(ctx.clientId);

    const aiSegments = await this.db
      .select({ text: transcriptSegments.text, turnIndex: transcriptSegments.turnIndex })
      .from(transcriptSegments)
      .where(tenantScope(transcriptSegments.clientId, ctx, eq(transcriptSegments.callId, callId)))
      .orderBy(asc(transcriptSegments.turnIndex));

    const verdicts = await this.db
      .select({ verdict: groundednessVerdicts.verdict })
      .from(groundednessVerdicts)
      .where(tenantScope(groundednessVerdicts.clientId, ctx, eq(groundednessVerdicts.callId, callId)));

    const result = scoreRubric(
      { firstAiText: aiSegments[0]?.text, lastAiText: aiSegments[aiSegments.length - 1]?.text, verdicts },
    );

    const scoreId = randomId('cs-');
    await this.db.insert(callScores).values(
      tenantValues(ctx, {
        id: scoreId,
        callId,
        score: result.score,
        breakdown: result.breakdown as unknown as Record<string, unknown>,
        flagged: result.flagged,
        scoredAt: new Date(),
      }),
    );
    await this.db
      .update(calls)
      .set({ scoreId, updatedAt: new Date() })
      .where(tenantScope(calls.clientId, ctx, eq(calls.id, callId)));

    return result;
  }

  /** Flagged (low-scoring) calls for a tenant — feeds the console review queue. */
  async listFlagged(ctx: TenantContext) {
    return this.db
      .select()
      .from(callScores)
      .where(tenantScope(callScores.clientId, ctx, eq(callScores.flagged, true)));
  }
}
