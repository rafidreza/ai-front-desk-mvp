import { describe, expect, it, vi } from 'vitest';
import { TenantScopeError } from '../src/db/tenant';
import {
  GroundedAnswerEngine,
  type Evidence,
  type LanguageModel,
  type Retriever,
} from '../src/services/answer-engine';

function retrieverReturning(evidence: Evidence[]): Retriever {
  return { retrieve: vi.fn(async () => evidence) };
}

function llmReturning(text: string): LanguageModel & { complete: ReturnType<typeof vi.fn> } {
  return { complete: vi.fn(async () => text) };
}

const ctx = { clientId: 'client-1' };

describe('GroundedAnswerEngine', () => {
  it('answers from evidence and returns that evidence for T14 to verify', async () => {
    const evidence: Evidence[] = [{ id: 'kb-1', text: 'Installation is free this month.' }];
    const llm = llmReturning('Yes, installation is free this month.');
    const engine = new GroundedAnswerEngine(retrieverReturning(evidence), llm);

    const result = await engine.respond(ctx, { question: 'is installation free?' });

    expect(result.text).toBe('Yes, installation is free this month.');
    expect(result.evidence).toEqual(evidence);
    expect(result.escalate).toBeUndefined();
    expect(llm.complete).toHaveBeenCalledOnce();
  });

  it('does NOT call the LLM and escalates when there is no evidence (no fabrication)', async () => {
    const llm = llmReturning('should not be used');
    const engine = new GroundedAnswerEngine(retrieverReturning([]), llm);

    const result = await engine.respond(ctx, { question: 'do you sell CCTV?' });

    expect(result.evidence).toEqual([]);
    expect(result.escalate).toEqual({ reason: 'out_of_kb' });
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('returns a Banglish fallback when unsupported Bangla needs escalation', async () => {
    const engine = new GroundedAnswerEngine(retrieverReturning([]), llmReturning('x'));
    const result = await engine.respond(ctx, { question: 'কিছু', language: 'bn' });
    expect(result.escalate).toEqual({ reason: 'out_of_kb' });
    expect(result.text).toContain('colleague ke connect');
  });

  it('fails closed on a blank clientId', async () => {
    const engine = new GroundedAnswerEngine(retrieverReturning([]), llmReturning('x'));
    await expect(engine.respond({ clientId: '' }, { question: 'x' })).rejects.toThrow(TenantScopeError);
  });
});
