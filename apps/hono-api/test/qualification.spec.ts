import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { QualificationService, evaluateIcp, type IcpConfig } from '../src/services/qualification';

describe('evaluateIcp (pure)', () => {
  const config: IcpConfig = {
    mode: 'all',
    conditions: [
      { field: 'coverage', op: 'eq', value: 'available' },
      { field: 'intent', op: 'in', value: ['new_subscription', 'upgrade'] },
      { field: 'name', op: 'exists' },
    ],
  };

  it('qualifies when all conditions pass', () => {
    const v = evaluateIcp(config, { coverage: 'available', intent: 'new_subscription', name: 'John' });
    expect(v.qualified).toBe(true);
    expect(v.confidence).toBe(1);
    expect(v.failed).toEqual([]);
  });

  it('disqualifies and reports the missing criteria', () => {
    const v = evaluateIcp(config, { coverage: 'not_available', intent: 'new_subscription', name: 'John' });
    expect(v.qualified).toBe(false);
    expect(v.failed).toContain('coverage');
    expect(v.reason).toMatch(/coverage/);
  });

  it('mode any qualifies on a single match', () => {
    const v = evaluateIcp({ mode: 'any', conditions: config.conditions }, { name: 'John' });
    expect(v.qualified).toBe(true);
    expect(v.passed).toContain('name');
  });

  it('returns not-qualified when no rules are configured', () => {
    expect(evaluateIcp({ conditions: [] }, {}).qualified).toBe(false);
  });
});

function fakeDb(policyRows: unknown[], inserts: unknown[] = []): AppDb {
  const selChain = { from: () => selChain, where: () => selChain, limit: async () => policyRows };
  const insChain = { values: (v: unknown) => { inserts.push(v); return Promise.resolve(); } };
  return { select: () => selChain, insert: () => insChain } as unknown as AppDb;
}

describe('QualificationService.qualify', () => {
  it('persists a verdict scoped to the tenant', async () => {
    const inserts: unknown[] = [];
    const rules: IcpConfig = { conditions: [{ field: 'coverage', op: 'eq', value: 'available' }] };
    const service = new QualificationService(fakeDb([{ config: rules }], inserts));
    const verdict = await service.qualify({ clientId: 'client-1' }, { threadId: 'thr-1', fields: { coverage: 'available' } });
    expect(verdict.qualified).toBe(true);
    expect(inserts[0]).toMatchObject({ clientId: 'client-1', threadId: 'thr-1', qualified: true });
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new QualificationService(explodingDb);
    await expect(service.qualify({ clientId: '' }, { threadId: 'thr-1', fields: {} })).rejects.toThrow(TenantScopeError);
  });
});
