import { describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../src/db/client';
import { TenantScopeError } from '../src/db/tenant';
import { EscalationService, evaluateEscalation } from '../src/services/escalation';

describe('evaluateEscalation (pure, priority order)', () => {
  it('does not escalate when all signals are clear', () => {
    expect(evaluateEscalation({ grounded: true }).escalate).toBe(false);
  });

  it('explicit request wins first', () => {
    const d = evaluateEscalation({ explicitRequest: true, grounded: false });
    expect(d).toEqual({ escalate: true, reason: 'explicit_request' });
  });

  it('escalates on an ungrounded answer', () => {
    expect(evaluateEscalation({ grounded: false })).toEqual({ escalate: true, reason: 'ungrounded_answer' });
  });

  it('escalates out-of-kb', () => {
    expect(evaluateEscalation({ outOfKb: true })).toEqual({ escalate: true, reason: 'out_of_kb' });
  });

  it('escalates a qualified lead needing a human', () => {
    expect(evaluateEscalation({ qualifiedNeedsHuman: true })).toEqual({ escalate: true, reason: 'qualified_lead' });
  });

  it('escalates after repeated failures', () => {
    expect(evaluateEscalation({ repeatedFailureCount: 2 })).toEqual({ escalate: true, reason: 'repeated_failure' });
    expect(evaluateEscalation({ repeatedFailureCount: 1 }).escalate).toBe(false);
  });
});

function insertDb(rows: unknown[], capture?: (v: unknown) => void): AppDb {
  const chain = {
    values: (v: unknown) => { capture?.(v); return chain; },
    returning: async () => rows,
  };
  return { insert: () => chain } as unknown as AppDb;
}

describe('EscalationService.raise', () => {
  it('inserts a tenant-scoped open escalation and emits an event', async () => {
    let captured: Record<string, unknown> | undefined;
    const events: unknown[] = [];
    const service = new EscalationService(
      insertDb([{ id: 'esc-1' }], (v) => { captured = v as Record<string, unknown>; }),
      (e) => { events.push(e); },
    );
    const row = await service.raise({ clientId: 'client-1' }, { reason: 'ungrounded_answer', callId: 'call-1' });
    expect(row).toEqual({ id: 'esc-1' });
    expect(captured).toMatchObject({ clientId: 'client-1', reason: 'ungrounded_answer', status: 'open' });
    expect(events[0]).toMatchObject({ type: 'escalation.created', clientId: 'client-1', escalationId: 'esc-1' });
  });

  it('fails closed on a blank clientId', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new EscalationService(explodingDb);
    await expect(service.raise({ clientId: '' }, { reason: 'x' })).rejects.toThrow(TenantScopeError);
  });
});

describe('EscalationService.evaluateAndRaise', () => {
  it('does not touch the db when no escalation is warranted', async () => {
    const explodingDb = new Proxy({}, { get() { throw new Error('db must not be touched'); } }) as unknown as AppDb;
    const service = new EscalationService(explodingDb);
    const result = await service.evaluateAndRaise({ clientId: 'client-1' }, { grounded: true }, {});
    expect(result.decision.escalate).toBe(false);
    expect(result).not.toHaveProperty('escalation');
  });

  it('raises when a signal fires', async () => {
    const emit = vi.fn();
    const service = new EscalationService(insertDb([{ id: 'esc-2' }]), emit);
    const result = await service.evaluateAndRaise({ clientId: 'client-1' }, { outOfKb: true }, { callId: 'call-1' });
    expect(result.decision).toEqual({ escalate: true, reason: 'out_of_kb' });
    expect(result.escalation).toEqual({ id: 'esc-2' });
  });
});
