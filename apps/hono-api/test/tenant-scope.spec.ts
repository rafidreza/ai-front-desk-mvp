import { describe, expect, it } from 'vitest';
import { tenantSecrets } from '../src/db/schema';
import { assertClientId, tenantScope, tenantValues, TenantScopeError } from '../src/db/tenant';

describe('assertClientId (fail closed)', () => {
  it('returns the clientId when present', () => {
    expect(assertClientId('client-123')).toBe('client-123');
  });

  it('throws on undefined', () => {
    expect(() => assertClientId(undefined)).toThrow(TenantScopeError);
  });

  it('throws on null', () => {
    expect(() => assertClientId(null)).toThrow(TenantScopeError);
  });

  it('throws on empty / whitespace string', () => {
    expect(() => assertClientId('')).toThrow(TenantScopeError);
    expect(() => assertClientId('   ')).toThrow(TenantScopeError);
  });
});

describe('tenantScope', () => {
  it('builds a defined predicate for a valid clientId', () => {
    const predicate = tenantScope(tenantSecrets.clientId, { clientId: 'client-123' });
    expect(predicate).toBeDefined();
  });

  it('throws (never returns an unscoped query) when clientId is blank', () => {
    expect(() => tenantScope(tenantSecrets.clientId, { clientId: '' })).toThrow(TenantScopeError);
  });
});

describe('tenantValues', () => {
  it('injects the asserted clientId into an insert values object', () => {
    const values = tenantValues({ clientId: 'client-123' }, { id: 'x', key: 'sip' });
    expect(values).toEqual({ id: 'x', key: 'sip', clientId: 'client-123' });
  });

  it('throws when clientId is missing', () => {
    expect(() => tenantValues({ clientId: '' }, { id: 'x' })).toThrow(TenantScopeError);
  });
});
