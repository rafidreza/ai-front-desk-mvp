import type { AppDb } from '../db/client';
import { icpRules, leadQualifications } from '../db/schema';
import { assertClientId, tenantScope, tenantValues, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';

/**
 * Lead qualification + ICP scoring (T7).
 *
 * Scores a caller against the client's per-tenant Ideal Customer Profile rules using the structured
 * thread state (T3) + lookup results (T6). Rules-first for explainability — a qualification always
 * comes with a reason. Deterministic; no LLM (an LLM-assist can layer on later for fuzzy cases).
 */

export type IcpCondition = {
  field: string;
  op: 'exists' | 'truthy' | 'eq' | 'neq' | 'in';
  value?: unknown;
};

export type IcpConfig = {
  mode?: 'all' | 'any';
  conditions: IcpCondition[];
};

export type QualificationVerdict = {
  qualified: boolean;
  reason: string;
  confidence: number;
  passed: string[];
  failed: string[];
};

function evalCondition(cond: IcpCondition, fields: Record<string, unknown>): boolean {
  const actual = fields[cond.field];
  switch (cond.op) {
    case 'exists':
      return actual !== undefined && actual !== null && actual !== '';
    case 'truthy':
      return Boolean(actual);
    case 'eq':
      return actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'in':
      return Array.isArray(cond.value) && cond.value.includes(actual);
    default:
      return false;
  }
}

/** Pure ICP evaluation. `all` = every condition must pass; `any` = at least one. */
export function evaluateIcp(config: IcpConfig, fields: Record<string, unknown>): QualificationVerdict {
  const mode = config.mode ?? 'all';
  const conditions = config.conditions ?? [];
  if (conditions.length === 0) {
    return { qualified: false, reason: 'no ICP rules configured', confidence: 0, passed: [], failed: [] };
  }
  const passed: string[] = [];
  const failed: string[] = [];
  for (const cond of conditions) {
    (evalCondition(cond, fields) ? passed : failed).push(cond.field);
  }
  const confidence = passed.length / conditions.length;
  const qualified = mode === 'all' ? failed.length === 0 : passed.length > 0;
  const reason = qualified
    ? `matched ${mode === 'all' ? 'all' : 'some'} ICP criteria (${passed.join(', ') || 'none'})`
    : `missing ICP criteria: ${failed.join(', ')}`;
  return { qualified, reason, confidence, passed, failed };
}

export class QualificationService {
  constructor(private readonly db: AppDb) {}

  async setRules(ctx: TenantContext, config: IcpConfig): Promise<void> {
    const clientId = assertClientId(ctx.clientId);
    const now = new Date();
    await this.db
      .insert(icpRules)
      .values({ id: randomId('icp-'), clientId, config: config as unknown as Record<string, unknown>, updatedAt: now })
      .onConflictDoUpdate({ target: icpRules.clientId, set: { config: config as unknown as Record<string, unknown>, updatedAt: now } });
  }

  async getRules(ctx: TenantContext): Promise<IcpConfig | null> {
    const [row] = await this.db
      .select({ config: icpRules.config })
      .from(icpRules)
      .where(tenantScope(icpRules.clientId, ctx))
      .limit(1);
    return (row?.config as IcpConfig | undefined) ?? null;
  }

  /** Score the caller against the tenant's ICP and persist the verdict. */
  async qualify(
    ctx: TenantContext,
    input: { threadId: string; callId?: string; fields: Record<string, unknown> },
  ): Promise<QualificationVerdict> {
    assertClientId(ctx.clientId);
    const config = (await this.getRules(ctx)) ?? { conditions: [] };
    const verdict = evaluateIcp(config, input.fields);
    await this.db.insert(leadQualifications).values(
      tenantValues(ctx, {
        id: randomId('lq-'),
        threadId: input.threadId,
        callId: input.callId,
        qualified: verdict.qualified,
        reason: verdict.reason,
        confidence: verdict.confidence,
        scoredAt: new Date(),
      }),
    );
    return verdict;
  }
}
