import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { operatorClientAccess } from '../db/schema';
import { assertClientId } from '../db/tenant';
import { randomId } from '../utils/crypto';

export type OperatorRole = 'admin' | 'operator' | 'read-only';

export type OperatorIdentity = {
  id: string;
  role: OperatorRole;
};

/**
 * RBAC + tenant access for internal operators / anchors (T26).
 *
 * The previously-global InternalUser becomes tenant-scoped here: an operator may only touch the
 * client(s) they are mapped to in OperatorClientAccess. `admin` is the one exception — an admin
 * has all-access by policy and is never gated by the mapping table.
 *
 * Access checks fail closed: an unmapped operator gets an empty client set, and `assertAccess`
 * throws. There is no default/fallback tenant.
 */
export class OperatorAccessService {
  constructor(private readonly db: AppDb) {}

  private isAdmin(operator: OperatorIdentity): boolean {
    return operator.role === 'admin';
  }

  /** Grant (or update the role of) an operator's access to a client. */
  async grant(operatorId: string, clientId: string, role: OperatorRole = 'operator'): Promise<void> {
    const scopedClientId = assertClientId(clientId);
    const now = new Date();
    await this.db
      .insert(operatorClientAccess)
      .values({
        id: randomId('oca-'),
        operatorId,
        clientId: scopedClientId,
        role,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [operatorClientAccess.operatorId, operatorClientAccess.clientId],
        set: { role, updatedAt: now },
      });
  }

  /** Revoke an operator's access to a client. */
  async revoke(operatorId: string, clientId: string): Promise<void> {
    await this.db
      .delete(operatorClientAccess)
      .where(and(eq(operatorClientAccess.operatorId, operatorId), eq(operatorClientAccess.clientId, assertClientId(clientId))));
  }

  /** The set of clientIds an operator may access via the mapping table (excludes admin policy). */
  async listMappedClientIds(operatorId: string): Promise<string[]> {
    const rows = await this.db
      .select({ clientId: operatorClientAccess.clientId })
      .from(operatorClientAccess)
      .where(eq(operatorClientAccess.operatorId, operatorId));
    return rows.map((row) => row.clientId);
  }

  /**
   * Does this operator have access to this client?
   * Admins: always true. Everyone else: only if mapped.
   */
  async hasAccess(operator: OperatorIdentity, clientId: string): Promise<boolean> {
    const scopedClientId = assertClientId(clientId);
    if (this.isAdmin(operator)) return true;
    const [row] = await this.db
      .select({ id: operatorClientAccess.id })
      .from(operatorClientAccess)
      .where(and(eq(operatorClientAccess.operatorId, operator.id), eq(operatorClientAccess.clientId, scopedClientId)))
      .limit(1);
    return row !== undefined;
  }

  /** Throw unless the operator may access the client. Use to guard tenant-scoped endpoints. */
  async assertAccess(operator: OperatorIdentity, clientId: string): Promise<void> {
    const allowed = await this.hasAccess(operator, clientId);
    if (!allowed) {
      throw new OperatorAccessError(operator.id, clientId);
    }
  }
}

export class OperatorAccessError extends Error {
  constructor(operatorId: string, clientId: string) {
    super(`Operator ${operatorId} is not authorised for client ${clientId}.`);
    this.name = 'OperatorAccessError';
  }
}
