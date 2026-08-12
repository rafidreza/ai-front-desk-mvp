import { describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import {
  ActionGovernanceService,
  type ActionExecutor,
  type ExecResult,
} from '../src/services/action-governance';

function okExecutor(result: ExecResult = { status: 'ok', data: { done: true } }): ActionExecutor & { execute: ReturnType<typeof vi.fn> } {
  return { execute: vi.fn(async () => result) };
}

function fakeDb(opts: { selRows?: unknown[]; inserts?: unknown[]; updates?: unknown[] } = {}): AppDb {
  const selRows = opts.selRows ?? [];
  const inserts = opts.inserts ?? [];
  const updates = opts.updates ?? [];
  const selChain = { from: () => selChain, where: () => selChain, limit: async () => selRows };
  const insChain = { values: (v: unknown) => { inserts.push(v); return Promise.resolve(); } };
  const updSet = { where: async () => [] };
  const updChain = { set: (v: unknown) => { updates.push(v); return updSet; } };
  return { select: () => selChain, insert: () => insChain, update: () => updChain } as unknown as AppDb;
}

const ctx = { clientId: 'client-1' };

describe('ActionGovernanceService.execute — class decides', () => {
  it('auto-executes a read action', async () => {
    const executor = okExecutor();
    const inserts: unknown[] = [];
    const service = new ActionGovernanceService(fakeDb({ inserts }), executor);
    const outcome = await service.execute(ctx, { callId: 'call-1', type: 'coverageLookup', actionClass: 'read' });
    expect(outcome.decision).toBe('executed');
    expect(executor.execute).toHaveBeenCalledOnce();
    expect(inserts[0]).toMatchObject({ clientId: 'client-1', actionClass: 'read', status: 'auto_executed' });
  });

  it('auto-executes a reversible write', async () => {
    const executor = okExecutor();
    const service = new ActionGovernanceService(fakeDb(), executor);
    const outcome = await service.execute(ctx, { callId: 'call-1', type: 'restart', actionClass: 'reversible_write' });
    expect(outcome.decision).toBe('executed');
    expect(executor.execute).toHaveBeenCalledOnce();
  });

  it('routes an over-threshold financial action to approval WITHOUT executing', async () => {
    const executor = okExecutor();
    const inserts: unknown[] = [];
    // No policy row -> default threshold 0; amount 1000 is over.
    const service = new ActionGovernanceService(fakeDb({ selRows: [], inserts }), executor);
    const outcome = await service.execute(ctx, {
      callId: 'call-1',
      type: 'postPayment',
      actionClass: 'irreversible_financial',
      amount: 1000,
    });
    expect(outcome.decision).toBe('pending_approval');
    expect(executor.execute).not.toHaveBeenCalled();
    expect(inserts[0]).toMatchObject({ status: 'pending_approval', actionClass: 'irreversible_financial' });
  });

  it('auto-clears an under-threshold financial action', async () => {
    const executor = okExecutor();
    const service = new ActionGovernanceService(
      fakeDb({ selRows: [{ config: { financialApprovalThreshold: 5000 } }] }),
      executor,
    );
    const outcome = await service.execute(ctx, {
      callId: 'call-1',
      type: 'postPayment',
      actionClass: 'irreversible_financial',
      amount: 1000,
    });
    expect(outcome.decision).toBe('executed');
    expect(executor.execute).toHaveBeenCalledOnce();
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new ActionGovernanceService(explodingDb, okExecutor());
    await expect(service.execute({ clientId: '' }, { callId: 'c', type: 't', actionClass: 'read' })).rejects.toThrow(
      TenantScopeError,
    );
  });
});

describe('ActionGovernanceService.decideApproval', () => {
  const pendingRow = {
    id: 'act-1',
    callId: 'call-1',
    type: 'postPayment',
    actionClass: 'irreversible_financial',
    status: 'pending_approval',
    payload: { connectorType: 'billing', amount: 1000 },
  };

  it('approve executes the action and marks it approved', async () => {
    const executor = okExecutor();
    const updates: unknown[] = [];
    const service = new ActionGovernanceService(fakeDb({ selRows: [pendingRow], updates }), executor);
    const outcome = await service.decideApproval(ctx, { actionId: 'act-1', approverId: 'ops-1', decision: 'approve' });
    expect(outcome.decision).toBe('executed');
    expect(executor.execute).toHaveBeenCalledOnce();
    expect(updates[0]).toMatchObject({ status: 'approved', approvedBy: 'ops-1' });
  });

  it('reject closes the action without executing', async () => {
    const executor = okExecutor();
    const updates: unknown[] = [];
    const service = new ActionGovernanceService(fakeDb({ selRows: [pendingRow], updates }), executor);
    const outcome = await service.decideApproval(ctx, { actionId: 'act-1', approverId: 'ops-1', decision: 'reject' });
    expect(outcome.decision).toBe('failed');
    expect(executor.execute).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ status: 'rejected', approvedBy: 'ops-1' });
  });

  it('throws when the action is not pending', async () => {
    const service = new ActionGovernanceService(fakeDb({ selRows: [{ ...pendingRow, status: 'auto_executed' }] }), okExecutor());
    await expect(
      service.decideApproval(ctx, { actionId: 'act-1', approverId: 'ops-1', decision: 'approve' }),
    ).rejects.toThrow(/not pending/);
  });
});
