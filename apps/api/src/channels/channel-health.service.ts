import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ClientProfile } from '../types/domain';
import { PilotClientService } from '../clients/pilot-client.service';

type HealthChannel = 'messenger' | 'whatsapp';
type HealthStatus = 'healthy' | 'warning' | 'needs_setup';

export interface ChannelHealthCheck {
  clientId: string;
  businessName: string;
  channel: HealthChannel;
  status: HealthStatus;
  setupLabel: string;
  detail: string;
  tokenExpiresAt?: string;
  tokenDaysRemaining?: number;
  webhookLastSeenAt?: string;
  eventsLast24h: number;
  failuresLast24h: number | null;
  templateCounts?: {
    approved: number;
    pending: number;
    rejected: number;
  };
}

@Injectable()
export class ChannelHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: PilotClientService,
  ) {}

  async getDashboard(): Promise<{ generatedAt: string; checks: ChannelHealthCheck[] }> {
    const clients = await this.clients.list();
    const checks = await Promise.all(clients.flatMap((client) => [
      this.buildMessengerCheck(client),
      this.buildWhatsappCheck(client),
    ]));
    return {
      generatedAt: new Date().toISOString(),
      checks,
    };
  }

  private async buildMessengerCheck(client: ClientProfile): Promise<ChannelHealthCheck> {
    const tokenExpiresAt = parseDate(process.env.MESSENGER_PAGE_TOKEN_EXPIRES_AT);
    const tokenDaysRemaining = tokenExpiresAt === undefined ? undefined : daysUntil(tokenExpiresAt);
    const pageCount = (client.channels ?? []).filter((channel) => channel.channel === 'messenger' && channel.status !== 'disabled').length;
    const webhook = await this.getWebhookStats(client.id, 'messenger');
    const tokenConfigured = process.env.MESSENGER_PAGE_ACCESS_TOKEN !== undefined && process.env.MESSENGER_PAGE_ACCESS_TOKEN !== '';
    const status: HealthStatus =
      pageCount === 0 || !tokenConfigured
        ? 'needs_setup'
        : tokenDaysRemaining !== undefined && tokenDaysRemaining <= 7
          ? 'warning'
          : 'healthy';

    return {
      clientId: client.id,
      businessName: client.businessName,
      channel: 'messenger',
      status,
      setupLabel: `${pageCount} page${pageCount === 1 ? '' : 's'} linked`,
      detail: tokenConfigured
        ? tokenDaysRemaining === undefined
          ? 'Page token configured. Add MESSENGER_PAGE_TOKEN_EXPIRES_AT to show TTL.'
          : `Page token ${tokenDaysRemaining < 0 ? 'expired' : 'expires'} in ${tokenDaysRemaining} days.`
        : 'Messenger page token is not configured.',
      tokenExpiresAt: tokenExpiresAt?.toISOString(),
      tokenDaysRemaining,
      webhookLastSeenAt: webhook.lastSeenAt,
      eventsLast24h: webhook.eventsLast24h,
      failuresLast24h: null,
    };
  }

  private async buildWhatsappCheck(client: ClientProfile): Promise<ChannelHealthCheck> {
    const accessTokenConfigured = process.env.WHATSAPP_ACCESS_TOKEN !== undefined && process.env.WHATSAPP_ACCESS_TOKEN !== '';
    const numberConfigured = process.env.WHATSAPP_PHONE_NUMBER_ID !== undefined && process.env.WHATSAPP_PHONE_NUMBER_ID !== '';
    const webhook = await this.getWebhookStats(client.id, 'whatsapp');
    const templateCounts = await this.getTemplateCounts(client.id);
    const status: HealthStatus =
      accessTokenConfigured && numberConfigured
        ? templateCounts.approved > 0 || webhook.eventsLast24h > 0
          ? 'healthy'
          : 'warning'
        : 'needs_setup';

    return {
      clientId: client.id,
      businessName: client.businessName,
      channel: 'whatsapp',
      status,
      setupLabel: numberConfigured ? `Number ID ${process.env.WHATSAPP_PHONE_NUMBER_ID}` : 'Number ID missing',
      detail: accessTokenConfigured && numberConfigured
        ? `${templateCounts.approved} approved templates, ${templateCounts.pending} pending, ${templateCounts.rejected} rejected.`
        : 'WhatsApp access token or phone number ID is missing.',
      webhookLastSeenAt: webhook.lastSeenAt,
      eventsLast24h: webhook.eventsLast24h,
      failuresLast24h: null,
      templateCounts,
    };
  }

  private async getWebhookStats(clientId: string, channel: HealthChannel) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [lastConversation, eventsLast24h] = await Promise.all([
      this.prisma.conversation.findFirst({
        where: { clientId, channel },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.conversation.count({
        where: { clientId, channel, updatedAt: { gte: since } },
      }),
    ]);
    return {
      lastSeenAt: lastConversation?.updatedAt.toISOString(),
      eventsLast24h,
    };
  }

  private async getTemplateCounts(clientId: string) {
    const rows = await this.prisma.whatsAppTemplate.groupBy({
      by: ['status'],
      where: { clientId },
      _count: { _all: true },
    });
    return {
      approved: rows.find((row) => row.status === 'approved')?._count._all ?? 0,
      pending: rows.find((row) => row.status === 'pending')?._count._all ?? 0,
      rejected: rows.find((row) => row.status === 'rejected')?._count._all ?? 0,
    };
  }
}

function parseDate(value?: string): Date | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
