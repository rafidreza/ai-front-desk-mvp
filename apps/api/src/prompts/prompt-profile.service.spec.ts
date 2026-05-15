import { describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { PromptProfileService } from './prompt-profile.service';

type ProfileRow = {
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
};

type VersionRow = Omit<ProfileRow, 'archivedAt' | 'updatedAt' | 'createdAt'> & {
  id: string;
  profileId: string;
  action: string;
  actorId: string;
  createdAt: Date;
};

type ProfileCreateData = Omit<ProfileRow, 'createdAt' | 'updatedAt'>;
type VersionCreateData = Omit<VersionRow, 'createdAt'> & { createdAt?: Date };
type ProfileUpdateData = Partial<Omit<ProfileRow, 'id' | 'clientId' | 'createdAt' | 'updatedAt' | 'version'>> & {
  version?: { increment: number };
};

function createMockPrisma() {
  const profiles = new Map<string, ProfileRow>();
  const versions = new Map<string, VersionRow>();

  const tx = {
    promptProfile: {
      findMany: async ({ where }: { where: { clientId: string; status?: string } }) =>
        Array.from(profiles.values()).filter((profile) => profile.clientId === where.clientId && (where.status === undefined || profile.status === where.status)),
      findFirst: async ({ where }: { where: { id?: string; clientId: string; status?: string } }) =>
        Array.from(profiles.values()).find(
          (profile) =>
            profile.clientId === where.clientId &&
            (where.id === undefined || profile.id === where.id) &&
            (where.status === undefined || profile.status === where.status),
        ) ?? null,
      create: async ({ data }: { data: ProfileCreateData }) => {
        const now = new Date();
        const created = { ...data, createdAt: now, updatedAt: now };
        profiles.set(created.id, created);
        return created;
      },
      update: async ({ where, data }: { where: { id: string }; data: ProfileUpdateData }) => {
        const existing = profiles.get(where.id);
        if (existing === undefined) throw new Error(`Missing profile ${where.id}`);
        const updated = {
          ...existing,
          ...data,
          version: data.version === undefined ? existing.version : existing.version + data.version.increment,
          updatedAt: new Date(),
        };
        profiles.set(where.id, updated);
        return updated;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { clientId: string; status: string; id?: { not: string } };
        data: Partial<Pick<ProfileRow, 'status' | 'archivedAt'>>;
      }) => {
        let count = 0;
        profiles.forEach((profile) => {
          if (profile.clientId !== where.clientId || profile.status !== where.status || profile.id === where.id?.not) return;
          profiles.set(profile.id, { ...profile, ...data, updatedAt: new Date() });
          count += 1;
        });
        return { count };
      },
    },
    promptProfileVersion: {
      create: async ({ data }: { data: VersionCreateData }) => {
        const created = { ...data, createdAt: data.createdAt ?? new Date() };
        versions.set(created.id, created);
        return created;
      },
      findMany: async ({ where }: { where: { clientId: string; profileId: string } }) =>
        Array.from(versions.values()).filter((version) => version.clientId === where.clientId && version.profileId === where.profileId),
      findFirst: async ({ where }: { where: { id: string; profileId: string; clientId: string } }) =>
        Array.from(versions.values()).find(
          (version) => version.id === where.id && version.profileId === where.profileId && version.clientId === where.clientId,
        ) ?? null,
    },
  };

  const prisma = {
    enabled: true,
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    promptProfile: tx.promptProfile,
    promptProfileVersion: tx.promptProfileVersion,
  } as unknown as PrismaService;

  return { prisma, profiles };
}

const promptInput = {
  clientId: 'pilot-client',
  name: 'Default support prompt',
  systemInstructions: 'Only answer using approved business knowledge.',
  toneRules: 'Friendly and concise.',
  escalationRules: 'Escalate refunds and complaints.',
  forbiddenClaims: 'Do not invent policy details.',
  fallbackBehavior: 'Say the team will check.',
};

describe('PromptProfileService', () => {
  it('archives the previous active profile when publishing a new active profile', async () => {
    const { prisma } = createMockPrisma();
    const service = new PromptProfileService(prisma);
    const active = await service.createDraft({ ...promptInput, status: 'active' });
    const draft = await service.createDraft({ ...promptInput, name: 'New prompt' });

    const published = await service.setStatus('pilot-client', draft.id, 'active', 'tester');
    const profiles = await service.list('pilot-client', 'all');

    expect(published.status).toBe('active');
    expect(profiles.find((profile) => profile.id === active.id)?.status).toBe('archived');
    expect(profiles.find((profile) => profile.id === draft.id)?.status).toBe('active');
  });

  it('increments versions on update and records rollback snapshots', async () => {
    const { prisma } = createMockPrisma();
    const service = new PromptProfileService(prisma);
    const profile = await service.createDraft({ ...promptInput });

    const updated = await service.update('pilot-client', profile.id, { name: 'Changed prompt', actorId: 'tester' });
    const createdVersion = (await service.listVersions('pilot-client', profile.id)).find((version) => version.action === 'created');
    if (createdVersion === undefined) throw new Error('Expected created version');
    const rolledBack = await service.rollback({ clientId: 'pilot-client', profileId: profile.id, versionId: createdVersion.id, actorId: 'tester' });
    const actions = (await service.listVersions('pilot-client', profile.id)).map((version) => version.action);

    expect(updated.version).toBe(2);
    expect(rolledBack.name).toBe('Default support prompt');
    expect(rolledBack.version).toBe(3);
    expect(actions).toEqual(expect.arrayContaining(['created', 'updated', 'rollback']));
  });
});
