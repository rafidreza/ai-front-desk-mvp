import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { AuthCodeDeliveryService } from '../notifications/auth-code-delivery.service';
import { ClientProfile } from '../types/domain';
import { PilotClientService } from './pilot-client.service';
import { ClientAuthService } from './client-auth.service';

const client: ClientProfile & {
  ownerEmail: string;
  digestEmail?: string;
  ownerPhone?: string;
  whatsappPoc?: string;
} = {
  id: 'pilot-client',
  businessName: 'Pilot Commerce',
  pageId: 'pilot-page',
  onboardingStatus: 'active',
  defaultLanguage: 'mixed',
  tone: 'friendly',
  escalationKeywords: ['refund'],
  ownerEmail: 'owner@example.com',
  digestEmail: undefined,
  ownerPhone: '+8801712345678',
  whatsappPoc: undefined,
};

type StoredChallenge = {
  id: string;
  clientId: string;
  channel: 'email' | 'whatsapp';
  destination: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

function createService(delivery?: AuthCodeDeliveryService) {
  const challenges = new Map<string, StoredChallenge>();
  const prisma = {
    client: {
      findFirst: vi.fn(async ({ where }: { where: { OR: Array<Record<string, string>> } }) => {
        const values = where.OR.flatMap((item) => Object.values(item));
        return values.includes(client.id) || values.includes(client.ownerEmail) || values.includes(client.ownerPhone ?? '') ? client : null;
      }),
    },
    clientAuthChallenge: {
      create: vi.fn(async ({ data }: { data: Omit<StoredChallenge, 'consumedAt'> }) => {
        challenges.set(data.id, { ...data, consumedAt: null });
        return challenges.get(data.id);
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => challenges.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<StoredChallenge> }) => {
        const existing = challenges.get(where.id);
        if (existing === undefined) throw new Error(`Missing challenge ${where.id}`);
        const updated = { ...existing, ...data };
        challenges.set(where.id, updated);
        return updated;
      }),
    },
  } as unknown as PrismaService;

  const clients = {
    findById: vi.fn(async () => client),
  } as unknown as PilotClientService;

  return { challenges, service: new ClientAuthService(prisma, clients, delivery) };
}

describe('ClientAuthService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv, CLIENT_AUTH_CODE_SECRET: 'x'.repeat(40), DEV_RETURN_AUTH_CODE: 'true', NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns a masked destination and verifies the dev code when explicitly enabled', async () => {
    const delivery = {
      sendCode: vi.fn(async () => ({ mode: 'dry-run' as const, channel: 'email' as const, destination: 'owner@example.com' })),
    } as unknown as AuthCodeDeliveryService;
    const { service } = createService(delivery);

    const challenge = await service.requestCode({ identifier: 'owner@example.com', channel: 'email' });
    const profile = await service.verifyCode({ challengeId: challenge.challengeId, code: challenge.devCode ?? '' });

    expect(challenge.sent).toBe(true);
    expect(challenge.destination).toBe('o***@example.com');
    expect(challenge.deliveryMode).toBe('dry-run');
    expect(challenge).not.toHaveProperty('clientId');
    expect(delivery.sendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        destination: 'owner@example.com',
        code: challenge.devCode,
      }),
    );
    expect(profile.id).toBe('pilot-client');
  });

  it('returns a uniform challenge-shaped response for unknown identifiers', async () => {
    const { challenges, service } = createService();

    const challenge = await service.requestCode({ identifier: 'unknown@example.com', channel: 'email' });

    expect(challenge.sent).toBe(true);
    expect(challenge.destination).toBe('u***@example.com');
    expect(challenge.devCode).toBeUndefined();
    expect(challenges.size).toBe(0);
  });

  it('uses a fixed development code when configured outside production', async () => {
    process.env = {
      ...originalEnv,
      CLIENT_AUTH_CODE_SECRET: 'x'.repeat(40),
      DEV_RETURN_AUTH_CODE: 'true',
      DEV_CLIENT_AUTH_CODE: '123456',
      NODE_ENV: 'development',
    };
    const { service } = createService();

    const challenge = await service.requestCode({ identifier: 'owner@example.com', channel: 'email' });

    expect(challenge.devCode).toBe('123456');
    await expect(service.verifyCode({ challengeId: challenge.challengeId, code: '123456' })).resolves.toMatchObject({
      id: 'pilot-client',
    });
  });

  it('rejects wrong, expired, and replayed codes', async () => {
    const { challenges, service } = createService();
    const challenge = await service.requestCode({ identifier: 'owner@example.com', channel: 'email' });

    await expect(service.verifyCode({ challengeId: challenge.challengeId, code: '000000' })).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.verifyCode({ challengeId: challenge.challengeId, code: challenge.devCode ?? '' })).resolves.toMatchObject({ id: 'pilot-client' });
    await expect(service.verifyCode({ challengeId: challenge.challengeId, code: challenge.devCode ?? '' })).rejects.toBeInstanceOf(UnauthorizedException);

    const expired = await service.requestCode({ identifier: 'owner@example.com', channel: 'email' });
    const stored = challenges.get(expired.challengeId);
    if (stored === undefined) throw new Error('Expected challenge to be stored');
    challenges.set(expired.challengeId, { ...stored, expiresAt: new Date(Date.now() - 1_000) });

    await expect(service.verifyCode({ challengeId: expired.challengeId, code: expired.devCode ?? '' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forbids development code return in production', () => {
    process.env = { ...originalEnv, CLIENT_AUTH_CODE_SECRET: 'x'.repeat(40), DEV_RETURN_AUTH_CODE: 'true', NODE_ENV: 'production' };

    expect(() => createService()).toThrow('DEV_RETURN_AUTH_CODE must not be enabled in production.');
  });
});
