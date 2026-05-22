import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { ClientProfile, PromptProfile } from '@ai-front-desk/shared';
import type { AppDb } from '../db/client';
import { promptProfiles, promptProfileVersions } from '../db/schema';
import { NotFoundError } from '../errors';
import { randomId } from '../utils/crypto';
import { toPromptProfile, toPromptVersion } from './mappers';

type PromptAction = 'baseline' | 'created' | 'updated' | 'published' | 'archived' | 'rollback';

function createDefaultPromptProfile(client: ClientProfile) {
  return {
    clientId: client.id,
    name: `${client.businessName} default front desk`,
    systemInstructions: `Only answer as the front desk support agent for ${client.businessName}. Use approved knowledge and avoid inventing details.`,
    toneRules: client.tone,
    escalationRules: `Escalate when customer mentions: ${client.escalationKeywords.join(', ')}.`,
    forbiddenClaims: 'Do not invent prices, stock, delivery promises, discounts, or policy details.',
    fallbackBehavior: 'Thanks for your message. Ami team ke check korte dicchi, tara shortly update debe.',
  };
}

export class PromptProfileService {
  constructor(private readonly db: AppDb) {}

  async getActiveForClient(client: ClientProfile): Promise<PromptProfile> {
    const [profile] = await this.db
      .select()
      .from(promptProfiles)
      .where(and(eq(promptProfiles.clientId, client.id), eq(promptProfiles.status, 'active')))
      .orderBy(desc(promptProfiles.updatedAt))
      .limit(1);
    if (profile !== undefined) return toPromptProfile(profile);
    return this.createDraft({ ...createDefaultPromptProfile(client), status: 'active', actorId: 'system-fallback' });
  }

  async list(clientId: string, status?: string) {
    const where = status === undefined || status === 'all'
      ? eq(promptProfiles.clientId, clientId)
      : and(eq(promptProfiles.clientId, clientId), eq(promptProfiles.status, status));
    const rows = await this.db.select().from(promptProfiles).where(where).orderBy(promptProfiles.status, desc(promptProfiles.updatedAt));
    return rows.map(toPromptProfile);
  }

  async createDraft(input: {
    clientId: string;
    name: string;
    systemInstructions: string;
    toneRules: string;
    escalationRules: string;
    forbiddenClaims: string;
    fallbackBehavior: string;
    status?: PromptProfile['status'];
    actorId?: string;
  }) {
    const status = input.status ?? 'draft';
    const now = new Date();
    if (status === 'active') {
      await this.db
        .update(promptProfiles)
        .set({ status: 'archived', archivedAt: now, updatedAt: now })
        .where(and(eq(promptProfiles.clientId, input.clientId), eq(promptProfiles.status, 'active')));
    }
    const [profile] = await this.db
      .insert(promptProfiles)
      .values({
        id: randomId(),
        clientId: input.clientId,
        name: input.name,
        systemInstructions: input.systemInstructions,
        toneRules: input.toneRules,
        escalationRules: input.escalationRules,
        forbiddenClaims: input.forbiddenClaims,
        fallbackBehavior: input.fallbackBehavior,
        status,
        version: 1,
        archivedAt: status === 'archived' ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await this.recordVersion(profile!, 'created', input.actorId);
    return toPromptProfile(profile!);
  }

  async update(clientId: string, profileId: string, input: Partial<Pick<PromptProfile, 'name' | 'systemInstructions' | 'toneRules' | 'escalationRules' | 'forbiddenClaims' | 'fallbackBehavior'>> & { actorId?: string }) {
    const [existing] = await this.db.select().from(promptProfiles).where(and(eq(promptProfiles.id, profileId), eq(promptProfiles.clientId, clientId))).limit(1);
    if (existing === undefined) throw new NotFoundError(`Prompt profile not found: ${profileId}`);
    const { actorId, ...changes } = input;
    const [updated] = await this.db
      .update(promptProfiles)
      .set({ ...changes, status: 'draft', archivedAt: null, version: sql`${promptProfiles.version} + 1`, updatedAt: new Date() })
      .where(eq(promptProfiles.id, profileId))
      .returning();
    await this.recordVersion(updated!, 'updated', actorId);
    return toPromptProfile(updated!);
  }

  async setStatus(clientId: string, profileId: string, status: PromptProfile['status'], actorId?: string) {
    const [existing] = await this.db.select().from(promptProfiles).where(and(eq(promptProfiles.id, profileId), eq(promptProfiles.clientId, clientId))).limit(1);
    if (existing === undefined) throw new NotFoundError(`Prompt profile not found: ${profileId}`);
    const now = new Date();
    if (status === 'active') {
      await this.db
        .update(promptProfiles)
        .set({ status: 'archived', archivedAt: now, updatedAt: now })
        .where(and(eq(promptProfiles.clientId, clientId), eq(promptProfiles.status, 'active'), ne(promptProfiles.id, profileId)));
    }
    const [updated] = await this.db
      .update(promptProfiles)
      .set({ status, archivedAt: status === 'archived' ? now : null, updatedAt: now })
      .where(eq(promptProfiles.id, profileId))
      .returning();
    await this.recordVersion(updated!, status === 'active' ? 'published' : status === 'archived' ? 'archived' : 'updated', actorId);
    return toPromptProfile(updated!);
  }

  async listVersions(clientId: string, profileId: string) {
    const rows = await this.db
      .select()
      .from(promptProfileVersions)
      .where(and(eq(promptProfileVersions.clientId, clientId), eq(promptProfileVersions.profileId, profileId)))
      .orderBy(desc(promptProfileVersions.createdAt));
    return rows.map(toPromptVersion);
  }

  async rollback(input: { clientId: string; profileId: string; versionId: string; actorId?: string }) {
    const [snapshot] = await this.db
      .select()
      .from(promptProfileVersions)
      .where(
        and(
          eq(promptProfileVersions.id, input.versionId),
          eq(promptProfileVersions.profileId, input.profileId),
          eq(promptProfileVersions.clientId, input.clientId),
        ),
      )
      .limit(1);
    if (snapshot === undefined) throw new NotFoundError(`Prompt version not found: ${input.versionId}`);
    const [updated] = await this.db
      .update(promptProfiles)
      .set({
        name: snapshot.name,
        systemInstructions: snapshot.systemInstructions,
        toneRules: snapshot.toneRules,
        escalationRules: snapshot.escalationRules,
        forbiddenClaims: snapshot.forbiddenClaims,
        fallbackBehavior: snapshot.fallbackBehavior,
        status: 'draft',
        archivedAt: null,
        version: sql`${promptProfiles.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promptProfiles.id, input.profileId))
      .returning();
    await this.recordVersion(updated!, 'rollback', input.actorId);
    return toPromptProfile(updated!);
  }

  private async recordVersion(
    profile: {
      id: string;
      clientId: string;
      version: number;
      name: string;
      systemInstructions: string;
      toneRules: string;
      escalationRules: string;
      forbiddenClaims: string;
      fallbackBehavior: string;
      status: string;
    },
    action: PromptAction,
    actorId = 'internal-console',
  ) {
    await this.db.insert(promptProfileVersions).values({
      id: randomId(),
      profileId: profile.id,
      clientId: profile.clientId,
      version: profile.version,
      name: profile.name,
      systemInstructions: profile.systemInstructions,
      toneRules: profile.toneRules,
      escalationRules: profile.escalationRules,
      forbiddenClaims: profile.forbiddenClaims,
      fallbackBehavior: profile.fallbackBehavior,
      status: profile.status,
      action,
      actorId,
    });
  }
}
