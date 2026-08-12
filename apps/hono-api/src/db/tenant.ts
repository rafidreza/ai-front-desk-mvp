import { and, eq, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Multitenancy enforcement (T26).
 *
 * Every tenant-scoped table carries a `clientId`. The rule (see docs/prd/00-project-overview.md
 * §5): no tenant query runs without a resolved clientId, and cross-tenant access is impossible
 * by construction — not by discipline.
 *
 * This module is the single sanctioned way to build a tenant predicate. Application code must
 * NOT hand-roll `eq(table.clientId, ...)` for tenant tables; it must call `tenantScope(...)` so
 * the fail-closed assertion always runs. A code-review grep for `.clientId,` outside this file
 * on the voice path is a red flag.
 */

export class TenantScopeError extends Error {
  constructor(message = 'A clientId is required for tenant-scoped access.') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

export type TenantContext = {
  clientId: string;
};

/**
 * Fail closed: a missing/blank clientId throws rather than returning an unscoped result set.
 * Returns the validated clientId so callers can use it inline.
 */
export function assertClientId(clientId: string | undefined | null): string {
  if (clientId === undefined || clientId === null || clientId.trim() === '') {
    throw new TenantScopeError();
  }
  return clientId;
}

/**
 * Build a tenant-scoped WHERE predicate. Always includes the clientId equality (asserted
 * non-empty), optionally AND-ed with additional conditions.
 *
 *   db.select().from(call).where(tenantScope(call.clientId, ctx, eq(call.status, 'active')))
 */
export function tenantScope(
  clientIdColumn: AnyPgColumn,
  ctx: TenantContext,
  ...extra: Array<SQL | undefined>
): SQL {
  const clientId = assertClientId(ctx.clientId);
  const predicate = and(eq(clientIdColumn, clientId), ...extra);
  // `and()` returns undefined only when every argument is undefined; the clientId eq is always
  // present, so the result is always a defined SQL. The assertion documents that invariant.
  if (predicate === undefined) {
    throw new TenantScopeError('Failed to build tenant predicate.');
  }
  return predicate;
}

/**
 * Values object for inserts into a tenant-scoped table — guarantees clientId is set.
 *
 *   db.insert(call).values(tenantValues(ctx, { id, status: 'ringing' }))
 */
export function tenantValues<T extends Record<string, unknown>>(
  ctx: TenantContext,
  values: T,
): T & { clientId: string } {
  return { ...values, clientId: assertClientId(ctx.clientId) };
}
