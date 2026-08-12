import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { actionPolicies, callActions } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';
import { ConnectorFrameworkService } from './connectors';

/**
 * Action-class governance (T9) — the spine of trust.
 *
 * Every action the AI can take is classified, and the class alone decides whether it clears or
 * requires a human. No special-case rules per action type:
 *   - read / reversible_write         -> auto-execute
 *   - irreversible_financial          -> under the tenant's approval threshold, clears;
 *                                        over it (or unknown amount), routes to a human.
 *
 * Every action is recorded (CallAction, T4) with its class + status, so the audit trail (T27)
 * shows what ran, why, and who approved. Execution itself is delegated to an ActionExecutor so
 * governance stays decoupled from the connector layer.
 */

export type ActionClass = 'read' | 'reversible_write' | 'irreversible_financial';

export type ActionStatus =
  | 'auto_executed'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'failed';

export type ActionRequest = {
  callId: string;
  type: string;
  actionClass: ActionClass;
  connectorType?: string;
  payload?: Record<string, unknown>;
  amount?: number; // for irreversible_financial threshold checks
  idempotencyKey?: string;
  turnIndex?: number;
};

export type ExecResult = {
  status: 'ok' | 'unknown' | 'queued' | 'failed';
  data?: unknown;
  error?: string;
};

/** Performs the actual side effect. Swappable; default wraps the connector framework (T24). */
export interface ActionExecutor {
  execute(ctx: TenantContext, action: ActionRequest): Promise<ExecResult>;
}

export class ConnectorActionExecutor implements ActionExecutor {
  constructor(private readonly connectors: ConnectorFrameworkService) {}

  async execute(ctx: TenantContext, action: ActionRequest): Promise<ExecResult> {
    if (action.connectorType === undefined) {
      return { status: 'failed', error: 'no connectorType on action' };
    }
    if (action.actionClass === 'read') {
      const result = await this.connectors.read(ctx, action.connectorType, action.payload ?? {});
      if (result.status === 'unknown') return { status: 'unknown', error: result.error };
      return { status: 'ok', data: result.data ?? null };
    }
    const idempotencyKey = action.idempotencyKey ?? randomId('idem-');
    const result = await this.connectors.write(ctx, action.connectorType, action.payload ?? {}, idempotencyKey);
    if (result.status === 'applied') return { status: 'ok', data: result.data };
    if (result.status === 'queued') return { status: 'queued', error: result.error };
    return { status: 'failed', error: result.error };
  }
}

export type GovernanceOutcome =
  | { decision: 'executed'; actionId: string; result: ExecResult }
  | { decision: 'pending_approval'; actionId: string }
  | { decision: 'failed'; actionId: string; result: ExecResult };

const DEFAULT_FINANCIAL_THRESHOLD = 0; // conservative: with no policy, all financial actions need a human.

export class ActionGovernanceService {
  constructor(
    private readonly db: AppDb,
    private readonly executor: ActionExecutor,
  ) {}

  /** The single gate all actions pass through. */
  async execute(ctx: TenantContext, action: ActionRequest): Promise<GovernanceOutcome> {
    assertClientId(ctx.clientId);

    if (action.actionClass === 'read' || action.actionClass === 'reversible_write') {
      return this.runAndRecord(ctx, action);
    }

    // irreversible_financial: threshold decides.
    const threshold = await this.financialThreshold(ctx);
    if (action.amount !== undefined && action.amount <= threshold) {
      return this.runAndRecord(ctx, action);
    }

    // Over threshold or unknown amount -> require human approval; do NOT execute.
    const actionId = await this.recordPending(ctx, action);
    return { decision: 'pending_approval', actionId };
  }

  /** Approve or reject a pending action. Approval executes it; rejection closes it. */
  async decideApproval(
    ctx: TenantContext,
    input: { actionId: string; approverId: string; decision: 'approve' | 'reject' },
  ): Promise<GovernanceOutcome> {
    assertClientId(ctx.clientId);
    const [row] = await this.db
      .select()
      .from(callActions)
      .where(tenantScope(callActions.clientId, ctx, eq(callActions.id, input.actionId)))
      .limit(1);
    if (row === undefined) throw new Error('Action not found.');
    if (row.status !== 'pending_approval') throw new Error(`Action is not pending approval (status: ${row.status}).`);

    if (input.decision === 'reject') {
      await this.db
        .update(callActions)
        .set({ status: 'rejected', approvedBy: input.approverId, decidedAt: new Date() })
        .where(tenantScope(callActions.clientId, ctx, eq(callActions.id, input.actionId)));
      return { decision: 'failed', actionId: input.actionId, result: { status: 'failed', error: 'rejected' } };
    }

    const action: ActionRequest = {
      callId: row.callId,
      type: row.type,
      actionClass: row.actionClass as ActionClass,
      connectorType: (row.payload as Record<string, unknown>)?.connectorType as string | undefined,
      payload: row.payload as Record<string, unknown>,
    };
    const result = await this.executor.execute(ctx, action);
    const ok = result.status === 'ok' || result.status === 'queued';
    await this.db
      .update(callActions)
      .set({
        status: ok ? 'approved' : 'failed',
        approvedBy: input.approverId,
        decidedAt: new Date(),
        result: (result.data as Record<string, unknown>) ?? null,
      })
      .where(tenantScope(callActions.clientId, ctx, eq(callActions.id, input.actionId)));
    return ok
      ? { decision: 'executed', actionId: input.actionId, result }
      : { decision: 'failed', actionId: input.actionId, result };
  }

  /** Pending approvals for a tenant (feeds the T10 console approvals inbox). */
  async listPendingApprovals(ctx: TenantContext) {
    return this.db
      .select()
      .from(callActions)
      .where(tenantScope(callActions.clientId, ctx, eq(callActions.status, 'pending_approval')));
  }

  /** Set the per-tenant governance policy (e.g. financial approval threshold). */
  async setPolicy(ctx: TenantContext, config: Record<string, unknown>): Promise<void> {
    const clientId = assertClientId(ctx.clientId);
    const now = new Date();
    await this.db
      .insert(actionPolicies)
      .values({ id: randomId('apol-'), clientId, config, updatedAt: now })
      .onConflictDoUpdate({ target: actionPolicies.clientId, set: { config, updatedAt: now } });
  }

  private async financialThreshold(ctx: TenantContext): Promise<number> {
    const [row] = await this.db
      .select({ config: actionPolicies.config })
      .from(actionPolicies)
      .where(tenantScope(actionPolicies.clientId, ctx))
      .limit(1);
    const value = row?.config?.financialApprovalThreshold;
    return typeof value === 'number' ? value : DEFAULT_FINANCIAL_THRESHOLD;
  }

  private async runAndRecord(ctx: TenantContext, action: ActionRequest): Promise<GovernanceOutcome> {
    const result = await this.executor.execute(ctx, action);
    // A read that degrades to `unknown` still *ran* — it is recorded as executed (with no data),
    // not as a failure. Only a hard 'failed' status is a failure.
    const ok = result.status !== 'failed';
    const actionId = await this.recordAction(ctx, action, ok ? 'auto_executed' : 'failed', result);
    return ok
      ? { decision: 'executed', actionId, result }
      : { decision: 'failed', actionId, result };
  }

  private async recordPending(ctx: TenantContext, action: ActionRequest): Promise<string> {
    return this.recordAction(ctx, action, 'pending_approval', null);
  }

  private async recordAction(
    ctx: TenantContext,
    action: ActionRequest,
    status: ActionStatus,
    result: ExecResult | null,
  ): Promise<string> {
    const id = randomId('act-');
    // Persist connectorType inside payload so a later approval can re-execute without re-deriving.
    const payload = { ...(action.payload ?? {}), connectorType: action.connectorType };
    await this.db.insert(callActions).values(
      tenantValues(ctx, {
        id,
        callId: action.callId,
        turnIndex: action.turnIndex,
        type: action.type,
        actionClass: action.actionClass,
        status,
        payload,
        result: (result?.data as Record<string, unknown>) ?? null,
        at: new Date(),
      }),
    );
    return id;
  }
}
