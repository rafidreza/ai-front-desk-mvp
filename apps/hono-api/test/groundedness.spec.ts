import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { GroundednessService, HeuristicGroundednessJudge } from '../src/services/groundedness';

describe('HeuristicGroundednessJudge', () => {
  const judge = new HeuristicGroundednessJudge(0.6);

  it('marks a well-supported answer grounded', async () => {
    const result = await judge.judge({
      answer: 'Installation is free this month for fiber connections.',
      evidence: ['Free installation this month on all fiber internet connections.'],
    });
    expect(result.verdict).toBe('grounded');
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it('marks an invented answer ungrounded', async () => {
    const result = await judge.judge({
      answer: 'We also provide CCTV cameras and home security monitoring bundles.',
      evidence: ['Free installation this month on all fiber internet connections.'],
    });
    expect(result.verdict).toBe('ungrounded');
  });

  it('is ungrounded when no evidence is provided', async () => {
    const result = await judge.judge({ answer: 'Your area is covered.', evidence: [] });
    expect(result.verdict).toBe('ungrounded');
    expect(result.score).toBe(0);
  });
});

function insertDb(capture?: (v: unknown) => void): AppDb {
  const insChain = { values: (v: unknown) => { capture?.(v); return Promise.resolve(); } };
  return { insert: () => insChain } as unknown as AppDb;
}

describe('GroundednessService.check', () => {
  it('persists the verdict and flags safe=false for an ungrounded answer', async () => {
    let captured: Record<string, unknown> | undefined;
    const service = new GroundednessService(insertDb((v) => { captured = v as Record<string, unknown>; }));
    const result = await service.check(
      { clientId: 'client-1' },
      { callId: 'call-1', turnIndex: 2, answer: 'We sell CCTV cameras too.', evidence: ['Fiber internet plans only.'] },
    );
    expect(result.safe).toBe(false);
    expect(captured).toMatchObject({ clientId: 'client-1', callId: 'call-1', verdict: 'ungrounded' });
  });

  it('flags safe=true for a grounded answer', async () => {
    const service = new GroundednessService(insertDb());
    const result = await service.check(
      { clientId: 'client-1' },
      { callId: 'call-1', answer: 'Installation is free this month.', evidence: ['Installation free this month.'] },
    );
    expect(result.safe).toBe(true);
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new GroundednessService(explodingDb);
    await expect(
      service.check({ clientId: '' }, { callId: 'c', answer: 'x', evidence: [] }),
    ).rejects.toThrow(TenantScopeError);
  });
});
