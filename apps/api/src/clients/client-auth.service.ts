import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuthCodeDeliveryService } from '../notifications/auth-code-delivery.service';
import { ClientProfile } from '../types/domain';
import { PilotClientService } from './pilot-client.service';

type AuthChannel = 'email' | 'whatsapp';

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function shouldReturnDevCode() {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_RETURN_AUTH_CODE === 'true') {
    throw new Error('DEV_RETURN_AUTH_CODE must not be enabled in production.');
  }
  return process.env.DEV_RETURN_AUTH_CODE === 'true';
}

function getAuthSecret() {
  const secret = process.env.CLIENT_AUTH_CODE_SECRET;
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

function hashesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (name === undefined || domain === undefined || name.length === 0) return 'configured email address';
  return `${name[0]}***@${domain}`;
}

function maskPhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return 'configured WhatsApp number';
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

function maskDestination(destination: string, channel: AuthChannel) {
  return channel === 'email' ? maskEmail(destination) : maskPhone(destination);
}

function maskRequestedIdentifier(identifier: string, channel: AuthChannel) {
  if (channel === 'email' && identifier.includes('@')) return maskEmail(identifier);
  if (channel === 'whatsapp' && /\d/.test(identifier)) return maskPhone(identifier);
  return channel === 'email' ? 'configured email address' : 'configured WhatsApp number';
}

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: PilotClientService,
    private readonly delivery?: AuthCodeDeliveryService,
  ) {
    shouldReturnDevCode();
    getAuthSecret();
  }

  async requestCode(input: { identifier: string; channel?: AuthChannel }) {
    const identifier = normalizeIdentifier(input.identifier);
    const requestedChannel = input.channel ?? 'email';
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
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      return {
        sent: true,
        challengeId: randomUUID(),
        channel: requestedChannel,
        destination: maskRequestedIdentifier(input.identifier.trim(), requestedChannel),
        expiresAt: expiresAt.toISOString(),
        deliveryMode: 'dry-run',
      };
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
    const deliveryResult = await this.delivery?.sendCode({
      businessName: client.businessName,
      channel,
      destination,
      code,
      expiresInMinutes: 10,
    });

    return {
      sent: true,
      challengeId,
      channel,
      destination: maskDestination(destination, channel),
      expiresAt: expiresAt.toISOString(),
      deliveryMode: deliveryResult?.mode ?? 'dry-run',
      devCode: shouldReturnDevCode() ? code : undefined,
    };
  }

  async verifyCode(input: { challengeId: string; code: string }): Promise<ClientProfile> {
    const challenge = await this.prisma.clientAuthChallenge.findUnique({ where: { id: input.challengeId } });

    if (challenge === null || challenge.consumedAt !== null || challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Login code is invalid or expired.');
    }

    if (!hashesMatch(challenge.codeHash, hashCode(challenge.id, input.code.trim()))) {
      throw new UnauthorizedException('Login code is invalid or expired.');
    }

    await this.prisma.clientAuthChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return this.clients.findById(challenge.clientId);
  }
}
