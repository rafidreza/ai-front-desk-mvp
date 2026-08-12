import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { ConnectorFrameworkService, HttpConnector } from '../src/services/connectors';
import type { TenantSecretsService } from '../src/services/tenant-secrets';

function mockFetch(response: { ok: boolean; status: number; body?: unknown } | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return { ok: response.ok, status: response.status, json: async () => response.body ?? null } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const config = { baseUrl: 'https://api.example.com', readPath: '/coverage', writePath: '/orders' };

describe('HttpConnector.read — never fabricates', () => {
  it('returns found + data on 200', async () => {
    mockFetch({ ok: true, status: 200, body: { available: true } });
    const c = new HttpConnector('coverage', config);
    expect(await c.read({ address: 'x' })).toEqual({ status: 'found', data: { available: true } });
  });

  it('returns not_found on 404', async () => {
    mockFetch({ ok: false, status: 404 });
    const c = new HttpConnector('coverage', config);
    expect(await c.read({ address: 'x' })).toEqual({ status: 'not_found' });
  });

  it('returns unknown (not a value) on 500', async () => {
    mockFetch({ ok: false, status: 500 });
    const c = new HttpConnector('coverage', config);
    expect(await c.read({ address: 'x' })).toMatchObject({ status: 'unknown' });
  });

  it('returns unknown on a network error', async () => {
    mockFetch(new Error('ECONNREFUSED'));
    const c = new HttpConnector('coverage', config);
    expect(await c.read({ address: 'x' })).toMatchObject({ status: 'unknown' });
  });
});

describe('HttpConnector.write', () => {
  it('returns applied on success', async () => {
    mockFetch({ ok: true, status: 201, body: { id: 'o1' } });
    const c = new HttpConnector('orders', config);
    expect(await c.write({ item: 'x' })).toEqual({ status: 'applied', data: { id: 'o1' } });
  });

  it('throws on a failed write (so the framework queues it)', async () => {
    mockFetch({ ok: false, status: 503 });
    const c = new HttpConnector('orders', config);
    await expect(c.write({ item: 'x' })).rejects.toThrow(/HTTP 503/);
  });
});

const stubSecrets = { get: async () => null } as unknown as TenantSecretsService;

// select(...).from(...).where(...).limit(...) => rows
function selectDb(rows: unknown[]): AppDb {
  const chain = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain } as unknown as AppDb;
}

describe('ConnectorFrameworkService.read — graceful', () => {
  it('returns unknown when no connector is configured (no fabrication)', async () => {
    const service = new ConnectorFrameworkService(selectDb([]), stubSecrets);
    expect(await service.read({ clientId: 'client-1' }, 'coverage', { address: 'x' })).toMatchObject({ status: 'unknown' });
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new ConnectorFrameworkService(explodingDb, stubSecrets);
    await expect(service.read({ clientId: '' }, 'coverage', {})).rejects.toThrow(TenantScopeError);
  });
});

describe('ConnectorFrameworkService.write — queue on failure', () => {
  it('queues the write and returns queued when the connector write fails', async () => {
    mockFetch({ ok: false, status: 503 });
    const inserted: unknown[] = [];
    // select returns the connector row; insert captures the queued write.
    const connectorRow = { id: 'con-1', status: 'active', type: 'orders', config };
    const selChain = { from: () => selChain, where: () => selChain, limit: async () => [connectorRow] };
    const insChain = {
      values: (v: unknown) => { inserted.push(v); return insChain; },
      onConflictDoNothing: () => insChain,
      returning: async () => [],
    };
    const db = { select: () => selChain, insert: () => insChain } as unknown as AppDb;
    const service = new ConnectorFrameworkService(db, stubSecrets);

    const result = await service.write({ clientId: 'client-1' }, 'orders', { item: 'x' }, 'idem-1');

    expect(result.status).toBe('queued');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ clientId: 'client-1', connectorId: 'con-1', idempotencyKey: 'idem-1' });
  });
});
