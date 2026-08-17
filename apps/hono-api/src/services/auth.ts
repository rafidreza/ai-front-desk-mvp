import { and, eq, isNull, or } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { clientAuthChallenges, clients } from '../db/schema';
import type { Env } from '../env';
import { allowPendingApprovalAuthFallback, authCodeSecret, isPreviewEnv, shouldReturnDevCode } from '../env';
import { BadRequestError, UnauthorizedError } from '../errors';
import { hmacSha256Hex, randomId, randomSixDigitCode, timingSafeStringEqual } from '../utils/crypto';
import { ClientService } from './clients';
import { AuthCodeDeliveryService } from './delivery';

type AuthChannel = 'email' | 'whatsapp';

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
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

function isPostmarkPendingApprovalError(error: unknown) {
  return error instanceof Error && /"ErrorCode"\s*:\s*412|pending approval/i.test(error.message);
}

export class ClientAuthService {
  constructor(
    private readonly db: AppDb,
    private readonly env: Env,
    private readonly clientsService: ClientService,
    private readonly delivery: AuthCodeDeliveryService,
  ) {
    shouldReturnDevCode(env);
    authCodeSecret(env);
  }

  async requestCode(input: { identifier: string; channel?: AuthChannel }) {
    const identifier = normalizeIdentifier(input.identifier);
    const requestedChannel = input.channel ?? 'email';
    const [client] = await this.db
      .select()
      .from(clients)
      .where(
        or(
          eq(clients.id, input.identifier.trim()),
          eq(clients.ownerEmail, identifier),
          eq(clients.digestEmail, identifier),
          eq(clients.ownerPhone, input.identifier.trim()),
          eq(clients.whatsappPoc, input.identifier.trim()),
        ),
      )
      .limit(1);

    if (client === undefined) {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      return {
        sent: true,
        challengeId: randomId(),
        channel: requestedChannel,
        destination: maskRequestedIdentifier(input.identifier.trim(), requestedChannel),
        expiresAt: expiresAt.toISOString(),
        deliveryMode: 'dry-run',
      };
    }

    const channel = input.channel ?? (client.ownerEmail !== null || client.digestEmail !== null ? 'email' : 'whatsapp');
    let destination = channel === 'email' ? client.ownerEmail ?? client.digestEmail : client.ownerPhone ?? client.whatsappPoc;
    if ((destination === null || destination === undefined || destination.trim() === '') && isPreviewEnv(this.env) && client.id === 'pilot-abc' && channel === 'email') {
      destination = 'abc-demo@daemion.local';
    }
    if (destination === null || destination === undefined || destination.trim() === '') {
      throw new BadRequestError(`Client does not have a ${channel} destination configured.`);
    }

    const challengeId = randomId();
    const code = randomSixDigitCode(this.env);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.db.insert(clientAuthChallenges).values({
      id: challengeId,
      clientId: client.id,
      channel,
      destination,
      codeHash: await this.hashCode(challengeId, code),
      expiresAt,
    });
    let deliveryMode: 'sent' | 'dry-run' | 'skipped';
    let fallbackCode: string | undefined;
    try {
      const deliveryResult = await this.delivery.sendCode({
        businessName: client.businessName,
        channel,
        destination,
        code,
        expiresInMinutes: 10,
      });
      deliveryMode = deliveryResult.mode;
    } catch (error) {
      if (channel !== 'email' || !allowPendingApprovalAuthFallback(this.env) || !isPostmarkPendingApprovalError(error)) {
        throw error;
      }
      deliveryMode = 'skipped';
      fallbackCode = code;
    }
    return {
      sent: true,
      challengeId,
      channel,
      destination: maskDestination(destination, channel),
      expiresAt: expiresAt.toISOString(),
      deliveryMode,
      devCode: shouldReturnDevCode(this.env) || fallbackCode !== undefined ? code : undefined,
    };
  }

  async verifyCode(input: { challengeId: string; code: string }) {
    const [challenge] = await this.db
      .select()
      .from(clientAuthChallenges)
      .where(and(eq(clientAuthChallenges.id, input.challengeId), isNull(clientAuthChallenges.consumedAt)))
      .limit(1);
    if (challenge === undefined || challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Login code is invalid or expired.');
    }
    if (!timingSafeStringEqual(challenge.codeHash, await this.hashCode(challenge.id, input.code.trim()))) {
      throw new UnauthorizedError('Login code is invalid or expired.');
    }
    await this.db.update(clientAuthChallenges).set({ consumedAt: new Date() }).where(eq(clientAuthChallenges.id, challenge.id));
    return this.clientsService.findById(challenge.clientId);
  }

  private hashCode(challengeId: string, code: string) {
    return hmacSha256Hex(authCodeSecret(this.env), `${challengeId}:${code}`);
  }
}
