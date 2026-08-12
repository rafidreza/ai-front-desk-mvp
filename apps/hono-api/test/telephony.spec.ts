import { describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import {
  CallEvent,
  CallRoutingError,
  CallService,
  TenantPhoneNumberService,
  normalizeE164,
} from '../src/services/telephony';

describe('normalizeE164', () => {
  it('keeps a leading + and strips non-digits', () => {
    expect(normalizeE164('+880 1712-345678')).toBe('+8801712345678');
    expect(normalizeE164('(02) 9876 5432')).toBe('0298765432');
  });

  it('is stable — same physical number normalises identically', () => {
    expect(normalizeE164('+8801712345678')).toBe(normalizeE164('+880 171 234 5678'));
  });

  it('throws when there are no digits', () => {
    expect(() => normalizeE164('   ')).toThrow();
  });
});

// select(...).from(...).where(...).limit(...) => rows
function selectDb(rows: unknown[]): AppDb {
  const chain = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain } as unknown as AppDb;
}

describe('TenantPhoneNumberService.resolveClientByDialledNumber', () => {
  it('returns the owning client for a mapped, active number', async () => {
    const service = new TenantPhoneNumberService(selectDb([{ id: 'tpn-1', clientId: 'client-1' }]));
    expect(await service.resolveClientByDialledNumber('+8801712345678')).toEqual({
      clientId: 'client-1',
      phoneNumberId: 'tpn-1',
    });
  });

  it('returns null for an unmapped number (no fallback tenant)', async () => {
    const service = new TenantPhoneNumberService(selectDb([]));
    expect(await service.resolveClientByDialledNumber('+8801700000000')).toBeNull();
  });
});

// Stub phone-number resolver so CallService can be tested without a real mapping db.
function stubResolver(result: { clientId: string; phoneNumberId: string } | null): TenantPhoneNumberService {
  return { resolveClientByDialledNumber: async () => result } as unknown as TenantPhoneNumberService;
}

describe('CallService.startInboundCall', () => {
  it('rejects an unmapped number with CallRoutingError (no default tenant)', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched when routing fails'); } }) as unknown as AppDb;
    const service = new CallService(explodingDb, stubResolver(null));
    await expect(service.startInboundCall({ dialledNumber: '+8801700000000' })).rejects.toThrow(CallRoutingError);
  });

  it('creates a tenant-scoped call and emits call.started for a mapped number', async () => {
    const insertChain = { values: () => insertChain, returning: async () => [{ id: 'call-1', clientId: 'client-1' }] };
    const db = { insert: () => insertChain } as unknown as AppDb;
    const events: CallEvent[] = [];
    const emit = vi.fn((e: CallEvent) => { events.push(e); });
    const service = new CallService(db, stubResolver({ clientId: 'client-1', phoneNumberId: 'tpn-1' }), emit);

    const call = await service.startInboundCall({ dialledNumber: '+880 171 234 5678' });

    expect(call).toEqual({ id: 'call-1', clientId: 'client-1' });
    expect(emit).toHaveBeenCalledOnce();
    expect(events[0]).toMatchObject({ type: 'call.started', clientId: 'client-1', callId: 'call-1' });
  });
});

describe('CallService tenant scoping (fail closed)', () => {
  it('get throws on a blank clientId', async () => {
    const service = new CallService(selectDb([]), stubResolver(null));
    await expect(service.get({ clientId: '' }, 'call-1')).rejects.toThrow(TenantScopeError);
  });

  it('list throws on a blank clientId', async () => {
    const listChain: Record<string, unknown> = {};
    listChain.from = () => listChain;
    listChain.where = () => listChain;
    listChain.orderBy = () => listChain;
    const db = { select: () => listChain } as unknown as AppDb;
    const service = new CallService(db, stubResolver(null));
    await expect(service.list({ clientId: '' })).rejects.toThrow(TenantScopeError);
  });
});
