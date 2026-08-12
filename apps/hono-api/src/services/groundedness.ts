import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { groundednessVerdicts } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Groundedness / hallucination detector (T14).
 *
 * The safety net for spoken answers: is what the AI is about to say supported by its KB evidence,
 * or invented? On a phone call there is no undo, so an ungrounded answer must be blocked and routed
 * to a safe path (hedge / lookup / escalate) instead of asserted.
 *
 * The judge is swappable. The default is a deterministic lexical-overlap heuristic (no LLM, fast,
 * testable now); an LLM-judge implementation can replace it behind the same interface.
 */

export type GroundednessVerdictLabel = 'grounded' | 'weak' | 'ungrounded';

export type GroundednessJudgement = {
  score: number; // 0..1 fraction of the answer supported by evidence
  verdict: GroundednessVerdictLabel;
  reason: string;
};

export interface GroundednessJudge {
  judge(input: { clientId: string; answer: string; evidence: string[] }): Promise<GroundednessJudgement>;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'you', 'your', 'our', 'this', 'that', 'with', 'have', 'has', 'was',
  'will', 'can', 'not', 'but', 'from', 'they', 'their', 'them', 'ala', 'apnar', 'ache', 'ki',
]);

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

/** Deterministic: fraction of the answer's content words that appear in the evidence. */
export class HeuristicGroundednessJudge implements GroundednessJudge {
  constructor(private readonly threshold = 0.6) {}

  async judge(input: { answer: string; evidence: string[] }): Promise<GroundednessJudgement> {
    const answerWords = contentWords(input.answer);
    if (answerWords.length === 0) {
      return { score: 1, verdict: 'grounded', reason: 'no factual content to verify' };
    }
    const evidenceWords = new Set(contentWords(input.evidence.join(' ')));
    if (evidenceWords.size === 0) {
      return { score: 0, verdict: 'ungrounded', reason: 'no evidence provided' };
    }
    const supported = answerWords.filter((w) => evidenceWords.has(w)).length;
    const score = supported / answerWords.length;
    const verdict: GroundednessVerdictLabel =
      score >= this.threshold ? 'grounded' : score >= this.threshold * 0.5 ? 'weak' : 'ungrounded';
    return { score, verdict, reason: `${supported}/${answerWords.length} answer terms supported by evidence` };
  }
}

export class GroundednessService {
  constructor(
    private readonly db: AppDb,
    private readonly judge: GroundednessJudge = new HeuristicGroundednessJudge(),
  ) {}

  /**
   * Judge an answer against its evidence and persist the verdict. Returns the judgement plus
   * `safe`: false means the answer is not sufficiently grounded and the caller MUST take a safe
   * path (hedge / lookup / escalate) rather than speak it.
   */
  async check(
    ctx: TenantContext,
    input: { callId: string; turnIndex?: number; answer: string; evidence: string[] },
  ): Promise<GroundednessJudgement & { safe: boolean }> {
    const clientId = assertClientId(ctx.clientId);
    const judgement = await this.judge.judge({ clientId, answer: input.answer, evidence: input.evidence });
    await this.db.insert(groundednessVerdicts).values(
      tenantValues(ctx, {
        id: randomId('gnd-'),
        callId: input.callId,
        turnIndex: input.turnIndex,
        score: judgement.score,
        verdict: judgement.verdict,
        reason: judgement.reason,
        at: new Date(),
      }),
    );
    return { ...judgement, safe: judgement.verdict === 'grounded' };
  }

  /** Verdicts for a call, tenant-scoped. */
  async listForCall(ctx: TenantContext, callId: string) {
    return this.db
      .select()
      .from(groundednessVerdicts)
      .where(tenantScope(groundednessVerdicts.clientId, ctx, eq(groundednessVerdicts.callId, callId)));
  }
}
