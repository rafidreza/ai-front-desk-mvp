import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { CallPersistenceService } from '../src/services/call-persistence';

// insert(...).values(...).onConflictDoUpdate(...).returning() => rows
function insertDb(rows: unknown[], capture?: (values: unknown) => void): AppDb {
  const chain = {
    values: (v: unknown) => {
      capture?.(v);
      return chain;
    },
    onConflictDoUpdate: () => chain,
    returning: async () => rows,
  };
  return { insert: () => chain } as unknown as AppDb;
}

// select(...).from(...).where(...).orderBy(...) => rows (thenable)
function selectDb(rows: unknown[]): AppDb {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = () => chain;
  chain.orderBy = () => chain;
  chain.limit = async () => rows;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return { select: () => chain } as unknown as AppDb;
}

describe('CallPersistenceService.persistTurn', () => {
  it('stamps the tenant clientId onto the segment values', async () => {
    let captured: Record<string, unknown> | undefined;
    const db = insertDb([{ id: 'seg-1', clientId: 'client-1', turnIndex: 0 }], (v) => {
      captured = v as Record<string, unknown>;
    });
    const service = new CallPersistenceService(db);
    await service.persistTurn(
      { clientId: 'client-1' },
      { callId: 'call-1', turnIndex: 0, speaker: 'caller', text: 'hello' },
    );
    expect(captured?.clientId).toBe('client-1');
    expect(captured?.callId).toBe('call-1');
    expect(captured?.turnIndex).toBe(0);
  });

  it('throws if the persisted row belongs to a different tenant (defence in depth)', async () => {
    const db = insertDb([{ id: 'seg-1', clientId: 'other-client', turnIndex: 0 }]);
    const service = new CallPersistenceService(db);
    await expect(
      service.persistTurn({ clientId: 'client-1' }, { callId: 'call-1', turnIndex: 0, speaker: 'ai', text: 'hi' }),
    ).rejects.toThrow(/tenant mismatch/);
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new CallPersistenceService(explodingDb);
    await expect(
      service.persistTurn({ clientId: '' }, { callId: 'call-1', turnIndex: 0, speaker: 'caller', text: 'x' }),
    ).rejects.toThrow(TenantScopeError);
  });
});

describe('CallPersistenceService.recordAction', () => {
  it('stamps the tenant clientId and action class', async () => {
    let captured: Record<string, unknown> | undefined;
    const db = insertDb([{ id: 'act-1', clientId: 'client-1' }], (v) => {
      captured = v as Record<string, unknown>;
    });
    const service = new CallPersistenceService(db);
    await service.recordAction(
      { clientId: 'client-1' },
      { callId: 'call-1', type: 'coverageLookup', actionClass: 'read' },
    );
    expect(captured?.clientId).toBe('client-1');
    expect(captured?.actionClass).toBe('read');
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new CallPersistenceService(explodingDb);
    await expect(
      service.recordAction({ clientId: '' }, { callId: 'call-1', type: 'x', actionClass: 'read' }),
    ).rejects.toThrow(TenantScopeError);
  });
});

describe('CallPersistenceService reads (tenant scoped)', () => {
  it('listTranscript throws on a blank clientId', async () => {
    const service = new CallPersistenceService(selectDb([]));
    await expect(service.listTranscript({ clientId: '' }, 'call-1')).rejects.toThrow(TenantScopeError);
  });

  it('getCallWithTranscript returns null when the call is absent', async () => {
    const service = new CallPersistenceService(selectDb([]));
    expect(await service.getCallWithTranscript({ clientId: 'client-1' }, 'missing')).toBeNull();
  });
});
