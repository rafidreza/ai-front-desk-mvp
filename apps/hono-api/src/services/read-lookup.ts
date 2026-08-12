import { assertClientId, type TenantContext } from '../db/tenant';
import { ActionGovernanceService } from './action-governance';
import { ThreadStateService } from './thread-state';

/**
 * Read-lookup connector (T6).
 *
 * The first concrete action: a read-only lookup into a client's external system during a call
 * (e.g. "is service available at this address?"). Thin now that the framework (T24) and governance
 * (T9) exist — it just runs the read AS A GOVERNED read action and folds the result into thread
 * state (T3). Crucially it NEVER fabricates: an unavailable/failed system yields `unknown`, and the
 * caller hedges/escalates instead of guessing.
 */

export type LookupResult = {
  status: 'found' | 'unknown';
  value?: unknown;
};

export class ReadLookupService {
  constructor(
    private readonly governance: ActionGovernanceService,
    private readonly threadState: ThreadStateService,
  ) {}

  async lookup(
    ctx: TenantContext,
    input: {
      callId: string;
      connectorType: string;
      query: Record<string, unknown>;
      threadId?: string;
      storeAsField?: string;
    },
  ): Promise<LookupResult> {
    assertClientId(ctx.clientId);
    const outcome = await this.governance.execute(ctx, {
      callId: input.callId,
      type: `lookup:${input.connectorType}`,
      actionClass: 'read',
      connectorType: input.connectorType,
      payload: input.query,
    });

    if (outcome.decision === 'executed' && outcome.result.status === 'ok') {
      const value = outcome.result.data;
      if (input.threadId !== undefined && input.storeAsField !== undefined) {
        await this.threadState.applyStatePatch(ctx, input.threadId, {
          [input.storeAsField]: { value, confidence: 1, source: input.connectorType },
        });
      }
      return { status: 'found', value };
    }

    // Degraded / unavailable -> unknown. No fabrication; caller hedges or escalates.
    return { status: 'unknown' };
  }
}
