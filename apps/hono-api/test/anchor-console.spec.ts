import { describe, expect, it, vi } from 'vitest';
import { AnchorConsoleService, ConsoleForbiddenError } from '../src/services/anchor-console';
import { OperatorAccessError, type OperatorAccessService, type OperatorIdentity } from '../src/services/operator-access';

const admin: OperatorIdentity = { id: 'ops-admin', role: 'admin' };
const operator: OperatorIdentity = { id: 'ops-1', role: 'operator' };
const readOnly: OperatorIdentity = { id: 'ops-ro', role: 'read-only' };
const ctx = { clientId: 'client-1' };

function accessAllowing(allowed: boolean): OperatorAccessService {
  return {
    assertAccess: vi.fn(async () => {
      if (!allowed) throw new OperatorAccessError('ops-x', 'client-1');
    }),
  } as unknown as OperatorAccessService;
}

function build(access: OperatorAccessService, overrides: Record<string, unknown> = {}) {
  const escalation = { listOpen: vi.fn(async () => [{ id: 'esc-1' }]), take: vi.fn(async () => ({ id: 'esc-1', status: 'taken' })), resolve: vi.fn(async () => ({ id: 'esc-1', status: 'resolved' })), ...overrides };
  const governance = { listPendingApprovals: vi.fn(async () => [{ id: 'act-1' }]), decideApproval: vi.fn(async () => ({ decision: 'executed', actionId: 'act-1', result: { status: 'ok' } })) };
  const callPersistence = { getCallWithTranscript: vi.fn(async () => ({ call: { id: 'call-1' }, transcript: [], actions: [] })) };
  const scoring = { listFlagged: vi.fn(async () => [{ id: 'cs-1' }]) };
  const service = new AnchorConsoleService(
    access,
    escalation as never,
    governance as never,
    callPersistence as never,
    scoring as never,
  );
  return { service, escalation, governance };
}

describe('AnchorConsoleService access control', () => {
  it('returns the queue for an authorised operator', async () => {
    const { service } = build(accessAllowing(true));
    expect(await service.queue(operator, ctx)).toEqual([{ id: 'esc-1' }]);
  });

  it('blocks an operator not authorised for the client', async () => {
    const { service } = build(accessAllowing(false));
    await expect(service.queue(operator, ctx)).rejects.toThrow(OperatorAccessError);
  });

  it('lets an admin see pending approvals', async () => {
    const { service } = build(accessAllowing(true));
    expect(await service.pendingApprovals(admin, ctx)).toEqual([{ id: 'act-1' }]);
  });
});

describe('AnchorConsoleService write-role enforcement', () => {
  it('a read-only operator cannot approve', async () => {
    const { service, governance } = build(accessAllowing(true));
    await expect(service.decideApproval(readOnly, ctx, { actionId: 'act-1', decision: 'approve' })).rejects.toThrow(
      ConsoleForbiddenError,
    );
    expect(governance.decideApproval).not.toHaveBeenCalled();
  });

  it('an operator can approve and the approver id is passed through', async () => {
    const { service, governance } = build(accessAllowing(true));
    await service.decideApproval(operator, ctx, { actionId: 'act-1', decision: 'approve' });
    expect(governance.decideApproval).toHaveBeenCalledWith(ctx, { actionId: 'act-1', approverId: 'ops-1', decision: 'approve' });
  });

  it('a read-only operator cannot take an escalation', async () => {
    const { service, escalation } = build(accessAllowing(true));
    await expect(service.takeEscalation(readOnly, ctx, 'esc-1')).rejects.toThrow(ConsoleForbiddenError);
    expect(escalation.take).not.toHaveBeenCalled();
  });
});
