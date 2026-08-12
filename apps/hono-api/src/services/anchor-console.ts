import { type TenantContext } from '../db/tenant';
import type { ActionGovernanceService, GovernanceOutcome } from './action-governance';
import type { CallPersistenceService } from './call-persistence';
import type { EscalationService } from './escalation';
import type { InteractionScoringService } from './interaction-scoring';
import type { OperatorAccessService, OperatorIdentity } from './operator-access';

/**
 * Anchor Console backend (T10).
 *
 * The server-side facade the human anchor's screen calls: escalation queue, call detail with full
 * context, and the pending-approvals inbox. Its whole job is COMPOSITION + ACCESS CONTROL — it wires
 * the existing services and enforces, on every call, that the operator may only touch clients they
 * are authorised for (T26 RBAC). Tenant filtering itself lives in the underlying services.
 *
 * NOTE: the console UI (Next.js) and live in-call takeover (T11) are not built here — this is the
 * data/permission layer they consume.
 */

export class ConsoleForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConsoleForbiddenError';
  }
}

function requireWriteRole(operator: OperatorIdentity) {
  if (operator.role === 'read-only') {
    throw new ConsoleForbiddenError('A read-only operator cannot perform this action.');
  }
}

export class AnchorConsoleService {
  constructor(
    private readonly access: OperatorAccessService,
    private readonly escalation: EscalationService,
    private readonly governance: ActionGovernanceService,
    private readonly callPersistence: CallPersistenceService,
    private readonly scoring: InteractionScoringService,
  ) {}

  /** The open escalation queue for a client the operator is authorised for. */
  async queue(operator: OperatorIdentity, ctx: TenantContext) {
    await this.access.assertAccess(operator, ctx.clientId);
    return this.escalation.listOpen(ctx);
  }

  /** Full call context (transcript + actions) for takeover. */
  async callDetail(operator: OperatorIdentity, ctx: TenantContext, callId: string) {
    await this.access.assertAccess(operator, ctx.clientId);
    return this.callPersistence.getCallWithTranscript(ctx, callId);
  }

  /** The pending-approvals inbox (governed actions awaiting a human). */
  async pendingApprovals(operator: OperatorIdentity, ctx: TenantContext) {
    await this.access.assertAccess(operator, ctx.clientId);
    return this.governance.listPendingApprovals(ctx);
  }

  /** Approve or reject a governed action. Requires a write role. */
  async decideApproval(
    operator: OperatorIdentity,
    ctx: TenantContext,
    input: { actionId: string; decision: 'approve' | 'reject' },
  ): Promise<GovernanceOutcome> {
    await this.access.assertAccess(operator, ctx.clientId);
    requireWriteRole(operator);
    return this.governance.decideApproval(ctx, { actionId: input.actionId, approverId: operator.id, decision: input.decision });
  }

  /** Take an escalation off the queue. Requires a write role. */
  async takeEscalation(operator: OperatorIdentity, ctx: TenantContext, escalationId: string) {
    await this.access.assertAccess(operator, ctx.clientId);
    requireWriteRole(operator);
    return this.escalation.take(ctx, escalationId, operator.id);
  }

  /** Resolve an escalation. Requires a write role. */
  async resolveEscalation(operator: OperatorIdentity, ctx: TenantContext, escalationId: string) {
    await this.access.assertAccess(operator, ctx.clientId);
    requireWriteRole(operator);
    return this.escalation.resolve(ctx, escalationId);
  }

  /** Low-scoring calls flagged for review. */
  async flaggedCalls(operator: OperatorIdentity, ctx: TenantContext) {
    await this.access.assertAccess(operator, ctx.clientId);
    return this.scoring.listFlagged(ctx);
  }
}
