import { describe, expect, it } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { OperatorAccessError, OperatorAccessService, type OperatorIdentity } from '../src/services/operator-access';

const admin: OperatorIdentity = { id: 'ops-admin', role: 'admin' };
const operator: OperatorIdentity = { id: 'ops-1', role: 'operator' };

// db.select(...).from(...).where(...).limit(...) → resolves to `rows`.
function fakeDbReturning(rows: unknown[]): AppDb {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
  };
  return { select: () => chain } as unknown as AppDb;
}

// A db that must not be queried — proves admin short-circuits before any DB call.
const explodingDb = new Proxy(
  {},
  { get() { throw new Error('db should not be touched for admin all-access'); } },
) as unknown as AppDb;

describe('OperatorAccessService.hasAccess', () => {
  it('admins have all-access without hitting the db', async () => {
    const service = new OperatorAccessService(explodingDb);
    expect(await service.hasAccess(admin, 'client-1')).toBe(true);
  });

  it('a mapped operator is granted access', async () => {
    const service = new OperatorAccessService(fakeDbReturning([{ id: 'oca-1' }]));
    expect(await service.hasAccess(operator, 'client-1')).toBe(true);
  });

  it('an unmapped operator is denied (fail closed)', async () => {
    const service = new OperatorAccessService(fakeDbReturning([]));
    expect(await service.hasAccess(operator, 'client-1')).toBe(false);
  });

  it('throws on a blank clientId', async () => {
    const service = new OperatorAccessService(explodingDb);
    await expect(service.hasAccess(operator, '')).rejects.toThrow(TenantScopeError);
  });
});

describe('OperatorAccessService.assertAccess', () => {
  it('throws OperatorAccessError for an unmapped operator', async () => {
    const service = new OperatorAccessService(fakeDbReturning([]));
    await expect(service.assertAccess(operator, 'client-1')).rejects.toThrow(OperatorAccessError);
  });

  it('resolves for an admin', async () => {
    const service = new OperatorAccessService(explodingDb);
    await expect(service.assertAccess(admin, 'client-1')).resolves.toBeUndefined();
  });
});
