import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { clientVoiceConfigs, knowledgeEntries, tenantPhoneNumbers } from '../db/schema';
import { assertClientId, tenantScope, type TenantContext } from '../db/tenant';
import { randomId } from '../utils/crypto';
import type { QualificationService, IcpConfig } from './qualification';
import type { TenantPhoneNumberService } from './telephony';

/**
 * Client / onboarding config backend (T12).
 *
 * The server side of the self-serve onboarding portal: manage the voice config, register the
 * client's forwarded phone number (maps it to their clientId — the linchpin of call-time tenant
 * resolution in T1), set ICP rules, and report a readiness check. All strictly tenant-scoped.
 *
 * NOTE: the portal UI (Next.js) is not built here — this is the config/data layer it consumes.
 */

export type VoiceConfig = {
  languagePosture?: string; // e.g. 'bn-first', 'en-first'
  greeting?: string;
  ttsVoice?: string;
  recordingConsent?: boolean;
};

export type Readiness = {
  numberReady: boolean;
  kbReady: boolean;
  voiceReady: boolean;
  ready: boolean;
};

/** Pure readiness computation from the three onboarding signals. */
export function computeReadiness(input: { hasNumber: boolean; hasKb: boolean; greeting?: string }): Readiness {
  const numberReady = input.hasNumber;
  const kbReady = input.hasKb;
  const voiceReady = Boolean(input.greeting && input.greeting.trim().length > 0);
  return { numberReady, kbReady, voiceReady, ready: numberReady && kbReady && voiceReady };
}

export class OnboardingService {
  constructor(
    private readonly db: AppDb,
    private readonly phoneNumbers: TenantPhoneNumberService,
    private readonly qualification: QualificationService,
  ) {}

  /** Register the client's forwarded number (delegates to T1's tenant mapping). */
  async registerNumber(ctx: TenantContext, input: { e164Number: string; label?: string }) {
    return this.phoneNumbers.register(ctx, input);
  }

  /** Set the per-tenant ICP rules (delegates to T7). */
  async setIcpRules(ctx: TenantContext, config: IcpConfig) {
    return this.qualification.setRules(ctx, config);
  }

  async setVoiceConfig(ctx: TenantContext, config: VoiceConfig): Promise<void> {
    const clientId = assertClientId(ctx.clientId);
    const now = new Date();
    await this.db
      .insert(clientVoiceConfigs)
      .values({ id: randomId('vcfg-'), clientId, config: config as Record<string, unknown>, updatedAt: now })
      .onConflictDoUpdate({ target: clientVoiceConfigs.clientId, set: { config: config as Record<string, unknown>, updatedAt: now } });
  }

  async getVoiceConfig(ctx: TenantContext): Promise<VoiceConfig | null> {
    const [row] = await this.db
      .select({ config: clientVoiceConfigs.config })
      .from(clientVoiceConfigs)
      .where(tenantScope(clientVoiceConfigs.clientId, ctx))
      .limit(1);
    return (row?.config as VoiceConfig | undefined) ?? null;
  }

  /** Onboarding readiness: number connected, KB present, greeting set. */
  async readiness(ctx: TenantContext): Promise<Readiness> {
    assertClientId(ctx.clientId);
    const [num] = await this.db
      .select({ id: tenantPhoneNumbers.id })
      .from(tenantPhoneNumbers)
      .where(tenantScope(tenantPhoneNumbers.clientId, ctx, eq(tenantPhoneNumbers.active, true)))
      .limit(1);
    const [kb] = await this.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(tenantScope(knowledgeEntries.clientId, ctx, eq(knowledgeEntries.status, 'active')))
      .limit(1);
    const config = await this.getVoiceConfig(ctx);
    return computeReadiness({ hasNumber: num !== undefined, hasKb: kb !== undefined, greeting: config?.greeting });
  }
}
