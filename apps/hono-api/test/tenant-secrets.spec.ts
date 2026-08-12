import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { encryptSecret, decryptSecret } from '../src/utils/encryption';
import { TenantSecretsService } from '../src/services/tenant-secrets';

const KEY = 'test-tenant-secret-encryption-key-32chars-min';

// A db that throws if touched — proves the fail-closed guards run BEFORE any query.
const explodingDb = new Proxy(
  {},
  {
    get() {
      throw new Error('db should not be touched when the tenant guard fails closed');
    },
  },
) as unknown as AppDb;

describe('TenantSecretsService — fail closed before DB', () => {
  const service = new TenantSecretsService(explodingDb, KEY);

  it('put throws on a blank clientId without touching the db', async () => {
    await expect(service.put({ clientId: '' }, 'sip.password', 'secret')).rejects.toThrow(TenantScopeError);
  });

  it('put throws on a blank key', async () => {
    await expect(service.put({ clientId: 'client-1' }, '   ', 'secret')).rejects.toThrow(/non-empty secret key/);
  });
});

describe('secret encryption round-trip (reused AES-GCM helper)', () => {
  it('encrypts to a non-plaintext value and decrypts back', async () => {
    const plaintext = 'super-secret-sip-password';
    const encrypted = await encryptSecret(KEY, plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(await decryptSecret(KEY, encrypted)).toBe(plaintext);
  });

  it('cannot be decrypted with the wrong key', async () => {
    const encrypted = await encryptSecret(KEY, 'value');
    await expect(decryptSecret('a-different-wrong-key-of-sufficient-len', encrypted)).rejects.toThrow();
  });
});
