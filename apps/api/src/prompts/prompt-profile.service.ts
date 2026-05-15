import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { ClientProfile, PromptProfile, PromptProfileVersion } from '../types/domain';

type PromptAction = PromptProfileVersion['action'];

function mapProfile(profile: {
  id: string;
  clientId: string;
  name: string;
  systemInstructions: string;
  toneRules: string;
  escalationRules: string;
  forbiddenClaims: string;
  fallbackBehavior: string;
  status: string;
  version: number;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PromptProfile {
  return {
    id: profile.id,
    clientId: profile.clientId,
    name: profile.name,
    systemInstructions: profile.systemInstructions,
    toneRules: profile.toneRules,
    escalationRules: profile.escalationRules,
    forbiddenClaims: profile.forbiddenClaims,
    fallbackBehavior: profile.fallbackBehavior,
    status: profile.status as PromptProfile['status'],
    version: profile.version,
    archivedAt: profile.archivedAt?.toISOString(),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function mapVersion(version: {
  id: string;
  profileId: string;
  clientId: string;
  version: number;
  name: string;
  systemInstructions: string;
  toneRules: string;
  escalationRules: string;
  forbiddenClaims: string;
  fallbackBehavior: string;
  status: string;
  action: string;
  actorId: string;
  createdAt: Date;
}): PromptProfileVersion {
  return {
    id: version.id,
    profileId: version.profileId,
    clientId: version.clientId,
    version: version.version,
    name: version.name,
    systemInstructions: version.systemInstructions,
    toneRules: version.toneRules,
    escalationRules: version.escalationRules,
    forbiddenClaims: version.forbiddenClaims,
    fallbackBehavior: version.fallbackBehavior,
    status: version.status as PromptProfile['status'],
    action: version.action as PromptProfileVersion['action'],
    actorId: version.actorId,
    createdAt: version.createdAt.toISOString(),
  };
}

export function createDefaultPromptProfile(client: ClientProfile): Omit<PromptProfile, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'> {
  return {
    clientId: client.id,
    name: 'Default support prompt',
    systemInstructions: `You are the AI front desk agent for ${client.businessName}. Only answer from approved knowledge. Keep replies short enough for Messenger commerce.`,
    toneRules: client.tone,
    escalationRules: `Escalate when the customer asks for a human, refund, cancellation, complaint handling, or when knowledge confidence is low. Escalation keywords: ${client.escalationKeywords.join(', ')}`,
    forbiddenClaims: 'Do not invent prices, delivery commitments, stock availability, discounts, refunds, or policy details that are not in the approved knowledge base.',
    fallbackBehavior: 'If the answer is missing, politely say a team member will check and get back shortly.',
  };
}

@Injectable()
export class PromptProfileService {
  constructor(private readonly prisma?: PrismaService) {}

  private requirePrisma(): PrismaService {
    if (this.prisma === undefined || this.prisma.enabled !== true) {
      throw new Error('PromptProfileService persistence requires PrismaService.');
    }
    return this.prisma;
  }

  async getActiveForClient(client: ClientProfile): Promise<PromptProfile> {
    if (this.prisma?.enabled !== true) {
      return {
        id: `${client.id}:prompt:fallback`,
        ...createDefaultPromptProfile(client),
        status: 'active',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const profile = await this.prisma.promptProfile.findFirst({
      where: { clientId: client.id, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });

    if (profile !== null) return mapProfile(profile);

    return this.createDraft({
      ...createDefaultPromptProfile(client),
      status: 'active',
      actorId: 'system-fallback',
    });
  }

  async list(clientId: string, status?: string): Promise<PromptProfile[]> {
    const profiles = await this.requirePrisma().promptProfile.findMany({
      where: { clientId, ...(status === undefined || status === 'all' ? {} : { status }) },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    return profiles.map(mapProfile);
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
  }): Promise<PromptProfile> {
    const prisma = this.requirePrisma();
    const status = input.status ?? 'draft';
    const profile = await prisma.$transaction(async (tx) => {
      if (status === 'active') {
        await tx.promptProfile.updateMany({
          where: { clientId: input.clientId, status: 'active' },
          data: { status: 'archived', archivedAt: new Date() },
        });
      }
      const created = await tx.promptProfile.create({
        data: {
          id: randomUUID(),
          clientId: input.clientId,
          name: input.name,
          systemInstructions: input.systemInstructions,
          toneRules: input.toneRules,
          escalationRules: input.escalationRules,
          forbiddenClaims: input.forbiddenClaims,
          fallbackBehavior: input.fallbackBehavior,
          status,
          version: 1,
          archivedAt: status === 'archived' ? new Date() : null,
        },
      });
      await this.recordVersion(tx, created, 'created', input.actorId);
      return created;
    });
    return mapProfile(profile);
  }

  async update(
    clientId: string,
    profileId: string,
    input: Partial<Pick<PromptProfile, 'name' | 'systemInstructions' | 'toneRules' | 'escalationRules' | 'forbiddenClaims' | 'fallbackBehavior'>> & {
      actorId?: string;
    },
  ): Promise<PromptProfile> {
    const { actorId, ...changes } = input;
    const prisma = this.requirePrisma();
    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.promptProfile.findFirst({ where: { id: profileId, clientId } });
      if (existing === null) throw new NotFoundException(`Prompt profile not found: ${profileId}`);

      const updated = await tx.promptProfile.update({
        where: { id: profileId },
        data: {
          ...changes,
          status: 'draft',
          archivedAt: null,
          version: { increment: 1 },
        },
      });
      await this.recordVersion(tx, updated, 'updated', actorId);
      return updated;
    });
    return mapProfile(profile);
  }

  async setStatus(clientId: string, profileId: string, status: PromptProfile['status'], actorId?: string): Promise<PromptProfile> {
    const prisma = this.requirePrisma();
    const profile = await prisma.$transaction(async (tx) => {
      const existing = await tx.promptProfile.findFirst({ where: { id: profileId, clientId } });
      if (existing === null) throw new NotFoundException(`Prompt profile not found: ${profileId}`);

      if (status === 'active') {
        await tx.promptProfile.updateMany({
          where: { clientId, status: 'active', id: { not: profileId } },
          data: { status: 'archived', archivedAt: new Date() },
        });
      }

      const updated = await tx.promptProfile.update({
        where: { id: profileId },
        data: {
          status,
          archivedAt: status === 'archived' ? new Date() : null,
        },
      });
      await this.recordVersion(tx, updated, status === 'active' ? 'published' : status === 'archived' ? 'archived' : 'updated', actorId);
      return updated;
    });
    return mapProfile(profile);
  }

  async listVersions(clientId: string, profileId: string): Promise<PromptProfileVersion[]> {
    const versions = await this.requirePrisma().promptProfileVersion.findMany({
      where: { clientId, profileId },
      orderBy: { createdAt: 'desc' },
    });
    return versions.map(mapVersion);
  }

  async rollback(input: { clientId: string; profileId: string; versionId: string; actorId?: string }): Promise<PromptProfile> {
    const prisma = this.requirePrisma();
    const profile = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.promptProfileVersion.findFirst({
        where: { id: input.versionId, profileId: input.profileId, clientId: input.clientId },
      });
      if (snapshot === null) throw new NotFoundException(`Prompt version not found: ${input.versionId}`);

      const updated = await tx.promptProfile.update({
        where: { id: input.profileId },
        data: {
          name: snapshot.name,
          systemInstructions: snapshot.systemInstructions,
          toneRules: snapshot.toneRules,
          escalationRules: snapshot.escalationRules,
          forbiddenClaims: snapshot.forbiddenClaims,
          fallbackBehavior: snapshot.fallbackBehavior,
          status: 'draft',
          archivedAt: null,
          version: { increment: 1 },
        },
      });
      await this.recordVersion(tx, updated, 'rollback', input.actorId);
      return updated;
    });
    return mapProfile(profile);
  }

  private async recordVersion(
    tx: Prisma.TransactionClient,
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
    await tx.promptProfileVersion.create({
      data: {
        id: randomUUID(),
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
      },
    });
  }
}
