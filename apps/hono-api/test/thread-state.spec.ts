import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import {
  ThreadStateService,
  flattenValues,
  lowConfidenceFields,
  mergeThreadFields,
  type ThreadFields,
} from '../src/services/thread-state';

describe('mergeThreadFields (pure, idempotent)', () => {
  const existing: ThreadFields = {
    name: { value: 'John', confidence: 0.9 },
    package: { value: '500Mbps', confidence: 0.4 },
  };

  it('patch overrides per field, preserves untouched fields', () => {
    const merged = mergeThreadFields(existing, { package: { value: 'business', confidence: 0.95 } });
    expect(merged.name).toEqual({ value: 'John', confidence: 0.9 });
    expect(merged.package).toEqual({ value: 'business', confidence: 0.95 });
  });

  it('is idempotent — applying the same patch twice yields the same result', () => {
    const patch: ThreadFields = { intent: { value: 'new_subscription', confidence: 0.8 } };
    const once = mergeThreadFields(existing, patch);
    const twice = mergeThreadFields(once, patch);
    expect(twice).toEqual(once);
  });
});

describe('flattenValues', () => {
  it('drops confidence/source, keeps values', () => {
    expect(flattenValues({ name: { value: 'John', confidence: 0.9 }, city: { value: 'Dhaka' } })).toEqual({
      name: 'John',
      city: 'Dhaka',
    });
  });
});

describe('lowConfidenceFields (uncertainty as a flag)', () => {
  it('flags fields below the threshold or with unknown confidence', () => {
    const fields: ThreadFields = {
      name: { value: 'John', confidence: 0.9 },
      package: { value: '500Mbps', confidence: 0.4 },
      address: { value: 'unknown' },
    };
    expect(lowConfidenceFields(fields, 0.6).sort()).toEqual(['address', 'package']);
  });
});

// insert(...).values(...).onConflictDoUpdate(...).returning() => rows
function insertDb(rows: unknown[], capture?: (v: unknown) => void): AppDb {
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

// select(...).from(...).where(...).limit(...) => rows
function selectDb(rows: unknown[]): AppDb {
  const chain = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain } as unknown as AppDb;
}

describe('ThreadStateService.getOrCreateThread', () => {
  it('stamps clientId and normalised identity', async () => {
    let captured: Record<string, unknown> | undefined;
    const db = insertDb([{ id: 'thr-1', clientId: 'client-1', identity: '+8801712345678' }], (v) => {
      captured = v as Record<string, unknown>;
    });
    const service = new ThreadStateService(db);
    await service.getOrCreateThread({ clientId: 'client-1' }, '  +8801712345678 ');
    expect(captured?.clientId).toBe('client-1');
    expect(captured?.identity).toBe('+8801712345678');
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new ThreadStateService(explodingDb);
    await expect(service.getOrCreateThread({ clientId: '' }, '+880')).rejects.toThrow(TenantScopeError);
  });

  it('rejects an empty identity', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new ThreadStateService(explodingDb);
    await expect(service.getOrCreateThread({ clientId: 'client-1' }, '   ')).rejects.toThrow(/identity/);
  });
});

describe('ThreadStateService.getThreadState', () => {
  it('returns empty object when no state exists', async () => {
    const service = new ThreadStateService(selectDb([]));
    expect(await service.getThreadState({ clientId: 'client-1' }, 'thr-1')).toEqual({});
  });

  it('fails closed on a blank clientId', async () => {
    const service = new ThreadStateService(selectDb([]));
    await expect(service.getThreadState({ clientId: '' }, 'thr-1')).rejects.toThrow(TenantScopeError);
  });
});
