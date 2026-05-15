import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { ClientProfile } from '../types/domain';
import { PilotClientService } from './pilot-client.service';

type AuthChannel = 'email' | 'whatsapp';

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function getAuthSecret() {
  const secret = process.env.CLIENT_AUTH_CODE_SECRET ?? process.env.INTERNAL_API_TOKEN;
  if (process.env.NODE_ENV === 'production' && (secret === undefined || secret.length < 32)) {
    throw new Error('CLIENT_AUTH_CODE_SECRET must be set to at least 32 characters in production.');
  }
  return secret ?? 'dev-client-auth-code-secret-only-for-local-work';
}

function hashCode(challengeId: string, code: string) {
  return createHmac('sha256', getAuthSecret()).update(`${challengeId}:${code}`).digest('hex');
}

function createCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: PilotClientService,
  ) {}

  async requestCode(input: { identifier: string; channel?: AuthChannel }) {
    const identifier = normalizeIdentifier(input.identifier);
    const client = await this.prisma.client.findFirst({
      where: {
        OR: [
          { id: input.identifier.trim() },
          { ownerEmail: identifier },
          { digestEmail: identifier },
          { ownerPhone: input.identifier.trim() },
          { whatsappPoc: input.identifier.trim() },
        ],
      },
    });

    if (client === null) {
      throw new NotFoundException('No client workspace found for this login.');
    }

    const channel = input.channel ?? (client.ownerEmail !== null || client.digestEmail !== null ? 'email' : 'whatsapp');
    const destination = channel === 'email' ? client.ownerEmail ?? client.digestEmail : client.ownerPhone ?? client.whatsappPoc;

    if (destination === null || destination === undefined || destination.trim() === '') {
      throw new BadRequestException(`Client does not have a ${channel} destination configured.`);
    }

    const challengeId = randomUUID();
    const code = createCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.clientAuthChallenge.create({
      data: {
        id: challengeId,
        clientId: client.id,
        channel,
        destination,
        codeHash: hashCode(challengeId, code),
        expiresAt,
      },
    });

    return {
      challengeId,
      clientId: client.id,
      channel,
      destination,
      expiresAt: expiresAt.toISOString(),
      devCode: process.env.NODE_ENV === 'production' ? undefined : code,
    };
  }

  async verifyCode(input: { challengeId: string; code: string }): Promise<ClientProfile> {
    const challenge = await this.prisma.clientAuthChallenge.findUnique({ where: { id: input.challengeId } });

    if (challenge === null || challenge.consumedAt !== null || challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Login code is invalid or expired.');
    }

    if (challenge.codeHash !== hashCode(challenge.id, input.code.trim())) {
      throw new UnauthorizedException('Login code is invalid or expired.');
    }

    await this.prisma.clientAuthChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return this.clients.findById(challenge.clientId);
  }
}
