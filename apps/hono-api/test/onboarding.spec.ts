import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { OnboardingService, computeReadiness } from '../src/services/onboarding';
import type { QualificationService } from '../src/services/qualification';
import type { TenantPhoneNumberService } from '../src/services/telephony';

describe('computeReadiness (pure)', () => {
  it('is ready only when number, KB, and greeting are all set', () => {
    expect(computeReadiness({ hasNumber: true, hasKb: true, greeting: 'Hi' }).ready).toBe(true);
  });
  it('is not ready with a blank greeting', () => {
    expect(computeReadiness({ hasNumber: true, hasKb: true, greeting: '   ' })).toMatchObject({ voiceReady: false, ready: false });
  });
  it('is not ready without a number', () => {
    expect(computeReadiness({ hasNumber: false, hasKb: true, greeting: 'Hi' }).ready).toBe(false);
  });
});

const phoneNumbers = {} as unknown as TenantPhoneNumberService;
const qualification = {} as unknown as QualificationService;

function insertDb(capture?: (v: unknown) => void): AppDb {
  const insChain = { values: (v: unknown) => { capture?.(v); return { onConflictDoUpdate: () => Promise.resolve() }; } };
  return { insert: () => insChain } as unknown as AppDb;
}

function selectDb(rows: unknown[]): AppDb {
  const chain = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain } as unknown as AppDb;
}

describe('OnboardingService.setVoiceConfig', () => {
  it('stamps the tenant clientId', async () => {
    let captured: Record<string, unknown> | undefined;
    const service = new OnboardingService(insertDb((v) => { captured = v as Record<string, unknown>; }), phoneNumbers, qualification);
    await service.setVoiceConfig({ clientId: 'client-1' }, { greeting: 'Assalamu alaikum' });
    expect(captured?.clientId).toBe('client-1');
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new OnboardingService(explodingDb, phoneNumbers, qualification);
    await expect(service.setVoiceConfig({ clientId: '' }, { greeting: 'x' })).rejects.toThrow(TenantScopeError);
  });
});

describe('OnboardingService.getVoiceConfig', () => {
  it('returns the stored config', async () => {
    const service = new OnboardingService(selectDb([{ config: { greeting: 'Hello' } }]), phoneNumbers, qualification);
    expect(await service.getVoiceConfig({ clientId: 'client-1' })).toEqual({ greeting: 'Hello' });
  });

  it('returns null when unset', async () => {
    const service = new OnboardingService(selectDb([]), phoneNumbers, qualification);
    expect(await service.getVoiceConfig({ clientId: 'client-1' })).toBeNull();
  });
});
