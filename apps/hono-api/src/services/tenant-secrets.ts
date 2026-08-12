import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { tenantSecrets } from '../db/schema';
import { assertClientId, tenantScope, type TenantContext } from '../db/tenant';
import { decryptSecret, encryptSecret } from '../utils/encryption';
import { randomId } from '../utils/crypto';

/**
 * Per-tenant secret storage (T26). Stores connector/SIP credentials encrypted at rest, keyed by
 * (clientId, key). Reuses the existing AES-GCM helpers in utils/encryption. Every read/write is
 * tenant-scoped and fail-closed — a secret written for client A can never be read as client B.
 */
export class TenantSecretsService {
  constructor(
    private readonly db: AppDb,
    private readonly encryptionKey: string,
  ) {}

  /** Upsert a secret for a tenant. Overwrites any existing value for the same key. */
  async put(ctx: TenantContext, key: string, plaintext: string): Promise<void> {
    const clientId = assertClientId(ctx.clientId);
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      throw new Error('A non-empty secret key is required.');
    }
    const encryptedValue = await encryptSecret(this.encryptionKey, plaintext);
    const now = new Date();
    await this.db
      .insert(tenantSecrets)
      .values({
        id: randomId('tsec-'),
        clientId,
        key: normalizedKey,
        encryptedValue,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [tenantSecrets.clientId, tenantSecrets.key],
        set: { encryptedValue, updatedAt: now },
      });
  }

  /** Read + decrypt a secret for a tenant. Returns null when the key is not set. */
  async get(ctx: TenantContext, key: string): Promise<string | null> {
    const [row] = await this.db
      .select({ encryptedValue: tenantSecrets.encryptedValue })
      .from(tenantSecrets)
      .where(tenantScope(tenantSecrets.clientId, ctx, eq(tenantSecrets.key, key.trim())))
      .limit(1);
    if (row === undefined) return null;
    return decryptSecret(this.encryptionKey, row.encryptedValue);
  }

  /** Delete a secret for a tenant. No-op if it does not exist. */
  async delete(ctx: TenantContext, key: string): Promise<void> {
    await this.db
      .delete(tenantSecrets)
      .where(tenantScope(tenantSecrets.clientId, ctx, eq(tenantSecrets.key, key.trim())));
  }

  /** List the secret keys held for a tenant (never the values). */
  async listKeys(ctx: TenantContext): Promise<string[]> {
    const rows = await this.db
      .select({ key: tenantSecrets.key })
      .from(tenantSecrets)
      .where(tenantScope(tenantSecrets.clientId, ctx));
    return rows.map((row) => row.key);
  }
}
