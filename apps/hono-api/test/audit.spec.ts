import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { AuditService } from '../src/services/audit';

function insertDb(capture?: (v: unknown) => void): AppDb {
  const insChain = { values: (v: unknown) => { capture?.(v); return Promise.resolve(); } };
  return { insert: () => insChain } as unknown as AppDb;
}

describe('AuditService.record', () => {
  it('appends a tenant-scoped entry', async () => {
    let captured: Record<string, unknown> | undefined;
    const service = new AuditService(insertDb((v) => { captured = v as Record<string, unknown>; }));
    await service.record(
      { clientId: 'client-1' },
      { actorType: 'operator', actorId: 'ops-1', eventType: 'action.approved', payload: { actionId: 'act-1' } },
    );
    expect(captured).toMatchObject({
      clientId: 'client-1',
      actorType: 'operator',
      actorId: 'ops-1',
      eventType: 'action.approved',
    });
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new AuditService(explodingDb);
    await expect(
      service.record({ clientId: '' }, { actorType: 'system', eventType: 'call.started' }),
    ).rejects.toThrow(TenantScopeError);
  });
});

describe('AuditService.list', () => {
  it('fails closed on a blank clientId', async () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = async () => [];
    const db = { select: () => chain } as unknown as AppDb;
    const service = new AuditService(db);
    await expect(service.list({ clientId: '' })).rejects.toThrow(TenantScopeError);
  });
});
