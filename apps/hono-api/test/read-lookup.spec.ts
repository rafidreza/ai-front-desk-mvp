import { describe, expect, it, vi } from 'vitest';
import { TenantScopeError } from '../src/db/tenant';
import type { ActionGovernanceService, GovernanceOutcome } from '../src/services/action-governance';
import { ReadLookupService } from '../src/services/read-lookup';
import type { ThreadStateService } from '../src/services/thread-state';

function governanceReturning(outcome: GovernanceOutcome): ActionGovernanceService {
  return { execute: vi.fn(async () => outcome) } as unknown as ActionGovernanceService;
}

const ctx = { clientId: 'client-1' };

describe('ReadLookupService', () => {
  it('returns found + value and stores it on the thread when the read succeeds', async () => {
    const governance = governanceReturning({ decision: 'executed', actionId: 'act-1', result: { status: 'ok', data: { available: true } } });
    const applyStatePatch = vi.fn(async () => ({}));
    const threadState = { applyStatePatch } as unknown as ThreadStateService;
    const service = new ReadLookupService(governance, threadState);

    const result = await service.lookup(ctx, {
      callId: 'call-1',
      connectorType: 'coverage',
      query: { address: 'x' },
      threadId: 'thr-1',
      storeAsField: 'coverageResult',
    });

    expect(result).toEqual({ status: 'found', value: { available: true } });
    expect(applyStatePatch).toHaveBeenCalledWith(ctx, 'thr-1', {
      coverageResult: { value: { available: true }, confidence: 1, source: 'coverage' },
    });
  });

  it('returns unknown (never fabricates) when the read degrades', async () => {
    const governance = governanceReturning({ decision: 'executed', actionId: 'act-1', result: { status: 'unknown' } });
    const threadState = { applyStatePatch: vi.fn() } as unknown as ThreadStateService;
    const service = new ReadLookupService(governance, threadState);

    const result = await service.lookup(ctx, { callId: 'call-1', connectorType: 'coverage', query: {} });
    expect(result).toEqual({ status: 'unknown' });
  });

  it('fails closed on a blank clientId', async () => {
    const governance = governanceReturning({ decision: 'executed', actionId: 'a', result: { status: 'ok' } });
    const threadState = { applyStatePatch: vi.fn() } as unknown as ThreadStateService;
    const service = new ReadLookupService(governance, threadState);
    await expect(service.lookup({ clientId: '' }, { callId: 'c', connectorType: 'coverage', query: {} })).rejects.toThrow(
      TenantScopeError,
    );
  });
});
