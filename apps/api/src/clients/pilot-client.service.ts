import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  Channel,
  ClientChannel,
  ClientComplianceProfile,
  ClientDpaProfile,
  ClientIntegrationStatus,
  ClientOnboardingProfile,
  ClientProfile,
  ClientStatus,
  ConversionChecklistItem,
} from '../types/domain';

type ClientLanguage = ClientProfile['defaultLanguage'];
type ClientChannelInput = {
  channel: Channel;
  externalId: string;
  label?: string;
  status?: ClientIntegrationStatus;
  isPrimary?: boolean;
  metadata?: Record<string, unknown>;
};
type ClientMutationInput = {
  businessName?: string;
  pageId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessCategory?: string;
  defaultLanguage?: ClientProfile['defaultLanguage'];
  tone?: string;
  whatsappPoc?: string;
  digestEmail?: string;
  onboardingStatus?: string;
  onboardingProfile?: ClientOnboardingProfile;
};
type DpaProfileInput = Omit<ClientDpaProfile, 'updatedAt'>;

type ClientChannelRecord = {
  id: string;
  clientId: string;
  channel: string;
  externalId: string;
  label: string;
  status: string;
  isPrimary: boolean;
  metadata: unknown;
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toClientProfile(client: {
  id: string;
  businessName: string;
  pageId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  businessCategory: string | null;
  status?: string;
  onboardingStatus: string;
  onboardingProfile: unknown;
  lifecycleStage?: string;
  conversionChecklist?: unknown;
  complianceProfile?: unknown;
  defaultLanguage: string;
  tone: string;
  escalationKeywords: string[];
  whatsappPoc: string | null;
  digestEmail: string | null;
  channels?: ClientChannelRecord[];
}): ClientProfile {
  const defaultLanguage: ClientLanguage =
    client.defaultLanguage === 'bangla' || client.defaultLanguage === 'english' || client.defaultLanguage === 'mixed'
      ? client.defaultLanguage
      : 'mixed';
  const status: ClientStatus = client.status === 'inactive' ? 'inactive' : 'active';

  return {
    id: client.id,
    businessName: client.businessName,
    pageId: client.pageId,
    ownerName: client.ownerName ?? undefined,
    ownerEmail: client.ownerEmail ?? undefined,
    ownerPhone: client.ownerPhone ?? undefined,
    businessCategory: client.businessCategory ?? undefined,
    status,
    onboardingStatus: client.onboardingStatus,
    lifecycleStage: toLifecycleStage(client.lifecycleStage),
    conversionChecklist: toConversionChecklist(client.conversionChecklist),
    complianceProfile: toComplianceProfile(client.complianceProfile),
    onboardingProfile: toOnboardingProfile(client.onboardingProfile),
    defaultLanguage,
    tone: client.tone,
    escalationKeywords: client.escalationKeywords,
    whatsappPoc: client.whatsappPoc ?? undefined,
    digestEmail: client.digestEmail ?? undefined,
    channels: normalizeClientChannels(client),
  };
}

function toComplianceProfile(value: unknown): ClientComplianceProfile | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const profile = value as Record<string, unknown>;
  const dpa = normalizeDpaProfile(profile.dpa);
  return dpa === undefined ? undefined : { dpa };
}

function normalizeDpaProfile(value: unknown): ClientDpaProfile | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const profile = value as Record<string, unknown>;
  const status =
    profile.status === 'sent' || profile.status === 'signed' || profile.status === 'countersigned'
      ? profile.status
      : 'not_sent';
  return {
    status,
    templateUrl: optionalString(profile.templateUrl),
    sentAt: optionalString(profile.sentAt),
    signerName: optionalString(profile.signerName),
    signerEmail: optionalString(profile.signerEmail),
    signedAt: optionalString(profile.signedAt),
    countersignedAt: optionalString(profile.countersignedAt),
    countersignedPdfUrl: optionalString(profile.countersignedPdfUrl),
    notes: optionalString(profile.notes),
    updatedAt: optionalString(profile.updatedAt),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function toLifecycleStage(value: unknown): ClientProfile['lifecycleStage'] {
  if (
    value === 'lead' ||
    value === 'onboarding' ||
    value === 'kb_building' ||
    value === 'shadow' ||
    value === 'live' ||
    value === 'paid' ||
    value === 'churned'
  ) {
    return value;
  }
  return 'lead';
}

function toConversionChecklist(value: unknown): ClientProfile['conversionChecklist'] {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item): ConversionChecklistItem => {
      const source: ConversionChecklistItem['source'] = item.source === 'auto' ? 'auto' : 'manual';
      return {
        id: String(item.id ?? ''),
        label: String(item.label ?? ''),
        done: item.done === true,
        source,
        detail: typeof item.detail === 'string' ? item.detail : undefined,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
      };
    })
    .filter((item) => item.id.length > 0 && item.label.length > 0);
}

function normalizeClientChannels(client: {
  id: string;
  pageId: string;
  channels?: ClientChannelRecord[];
}): ClientChannel[] {
  const records = client.channels ?? [];
  const channels = records
    .filter((channel) => channel.channel === 'messenger' || channel.channel === 'whatsapp' || channel.channel === 'web')
    .map((channel) => ({
      id: channel.id,
      clientId: channel.clientId,
      channel: channel.channel as Channel,
      externalId: channel.externalId,
      label: channel.label,
      status: normalizeChannelStatus(channel.status),
      isPrimary: channel.isPrimary,
      metadata: toMetadata(channel.metadata),
      connectedAt: channel.connectedAt.toISOString(),
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
    }));

  if (channels.some((channel) => channel.channel === 'messenger')) return channels;
  if (client.pageId.trim() === '' || client.pageId.endsWith('-page-pending')) return channels;

  return [
    {
      id: `${client.id}:messenger:${client.pageId}`,
      clientId: client.id,
      channel: 'messenger',
      externalId: client.pageId,
      label: 'Primary Facebook Page',
      status: 'connected',
      isPrimary: true,
      metadata: { legacy: true },
      connectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...channels,
  ];
}

function normalizeChannelStatus(status: string): ClientIntegrationStatus {
  if (status === 'connected' || status === 'available' || status === 'needs_setup' || status === 'disabled') return status;
  return 'needs_setup';
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toOnboardingProfile(value: unknown): ClientOnboardingProfile | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as ClientOnboardingProfile;
}

const pilotClientFallback: ClientProfile = {
  id: 'pilot-client',
  businessName: 'Pilot F-Commerce Seller',
  pageId: 'pilot-page',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
  escalationKeywords: ['refund', 'complaint', 'wrong product', 'cancel', 'human', 'রিফান্ড', 'অভিযোগ'],
  status: 'active',
  onboardingStatus: 'live',
  lifecycleStage: 'live',
  channels: [
    {
      id: 'pilot-client:messenger:pilot-page',
      clientId: 'pilot-client',
      channel: 'messenger',
      externalId: 'pilot-page',
      label: 'Primary Facebook Page',
      status: 'connected',
      isPrimary: true,
      metadata: { fallback: true },
      connectedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

@Injectable()
export class PilotClientService {
  constructor(private readonly prisma?: PrismaService) {}

  private requirePrisma(): PrismaService {
    if (this.prisma === undefined) {
      throw new Error('PilotClientService persistence requires PrismaService.');
    }
    return this.prisma;
  }

  async list(): Promise<ClientProfile[]> {
    if (this.prisma?.enabled !== true) {
      return [pilotClientFallback];
    }
    const clients = await this.prisma.client.findMany({
      include: { channels: { orderBy: [{ channel: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }] } },
      orderBy: { createdAt: 'desc' },
    });
    return clients.map(toClientProfile);
  }

  async create(input: {
    businessName: string;
    pageId?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    businessCategory?: string;
    defaultLanguage?: ClientProfile['defaultLanguage'];
    tone?: string;
    whatsappPoc?: string;
    digestEmail?: string;
  }): Promise<ClientProfile> {
    const id = `client-${randomUUID()}`;
    const client = await this.requirePrisma().client.create({
      data: {
        id,
        businessName: input.businessName,
        pageId: input.pageId?.trim() || `${id}-page-pending`,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        businessCategory: input.businessCategory,
        onboardingStatus: 'signup_started',
        status: 'active',
        defaultLanguage: input.defaultLanguage ?? 'mixed',
        tone: input.tone ?? 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
        escalationKeywords: ['refund', 'complaint', 'wrong product', 'cancel', 'human', 'রিফান্ড', 'অভিযোগ'],
        whatsappPoc: input.whatsappPoc,
        digestEmail: input.digestEmail ?? input.ownerEmail,
        channels: input.pageId?.trim()
          ? {
              create: {
                id: `channel-${randomUUID()}`,
                channel: 'messenger',
                externalId: input.pageId.trim(),
                label: 'Primary Facebook Page',
                status: 'connected',
                isPrimary: true,
              },
            }
          : undefined,
      },
      include: { channels: true },
    });

    return toClientProfile(client);
  }

  async createInternal(input: { businessName: string } & ClientMutationInput): Promise<ClientProfile> {
    const id = `client-${randomUUID()}`;
    const client = await this.requirePrisma().client.create({
      data: {
        id,
        businessName: input.businessName,
        pageId: input.pageId?.trim() || `${id}-page-pending`,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        businessCategory: input.businessCategory,
        status: 'active',
        onboardingStatus: input.onboardingStatus ?? 'onboarding_complete',
        onboardingProfile: input.onboardingProfile as Prisma.InputJsonValue | undefined,
        defaultLanguage: input.defaultLanguage ?? 'mixed',
        tone: input.tone ?? 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
        escalationKeywords: ['refund', 'complaint', 'wrong product', 'cancel', 'human', 'রিফান্ড', 'অভিযোগ'],
        whatsappPoc: input.whatsappPoc,
        digestEmail: input.digestEmail ?? input.ownerEmail,
        channels: input.pageId?.trim()
          ? {
              create: {
                id: `channel-${randomUUID()}`,
                channel: 'messenger',
                externalId: input.pageId.trim(),
                label: 'Primary Facebook Page',
                status: 'connected',
                isPrimary: true,
              },
            }
          : undefined,
      },
      include: { channels: true },
    });

    return toClientProfile(client);
  }

  async findByPageId(pageId: string): Promise<ClientProfile> {
    if (this.prisma?.enabled !== true) {
      if (pageId === pilotClientFallback.pageId) return pilotClientFallback;
      throw new NotFoundException(`Client not found for page: ${pageId}`);
    }
    const client = await this.prisma.client.findFirst({
      where: {
        OR: [
          { pageId },
          { channels: { some: { channel: 'messenger', externalId: pageId, status: { not: 'disabled' } } } },
        ],
      },
      include: { channels: true },
    });
    if (client !== null) {
      return toClientProfile(client);
    }

    throw new NotFoundException(`Client not found for page: ${pageId}`);
  }

  async findByWhatsAppIdentifier(identifier: string): Promise<ClientProfile> {
    if (this.prisma?.enabled !== true) {
      if (identifier === pilotClientFallback.pageId || identifier === process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return pilotClientFallback;
      }
      throw new NotFoundException(`Client not found for WhatsApp identifier: ${identifier}`);
    }

    const client = await this.prisma.client.findFirst({
      where: {
        OR: [
          { pageId: identifier },
          { id: identifier },
          { channels: { some: { channel: 'whatsapp', externalId: identifier, status: { not: 'disabled' } } } },
        ],
      },
      include: { channels: true },
    });
    if (client !== null) {
      return toClientProfile(client);
    }

    throw new NotFoundException(`Client not found for WhatsApp identifier: ${identifier}`);
  }

  async findById(clientId: string): Promise<ClientProfile> {
    if (this.prisma?.enabled !== true) {
      if (clientId === pilotClientFallback.id) return pilotClientFallback;
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { channels: { orderBy: [{ channel: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }] } },
    });
    if (client !== null) {
      return toClientProfile(client);
    }

    throw new NotFoundException(`Client not found: ${clientId}`);
  }

  async updateOnboarding(
    clientId: string,
    input: {
      businessCategory?: string;
      pageId?: string;
      whatsappPoc?: string;
      onboardingStatus?: string;
      onboardingProfile?: ClientOnboardingProfile;
    },
  ): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }

    const onboardingProfile =
      input.onboardingProfile === undefined
        ? undefined
        : {
            ...(toOnboardingProfile(existing.onboardingProfile) ?? {}),
            ...input.onboardingProfile,
          };
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        businessCategory: input.businessCategory,
        pageId: input.pageId,
        whatsappPoc: input.whatsappPoc,
        onboardingStatus: input.onboardingStatus,
        onboardingProfile: onboardingProfile as Prisma.InputJsonValue | undefined,
      },
      include: { channels: true },
    });
    return toClientProfile(client);
  }

  async updateLifecycleStage(clientId: string, stage: string): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { lifecycleStage: stage },
      include: { channels: true },
    });
    return toClientProfile(client);
  }

  async updateConversionChecklist(
    clientId: string,
    items: ConversionChecklistItem[],
  ): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
    const client = await prisma.client.update({
      where: { id: clientId },
      data: { conversionChecklist: items as unknown as Prisma.InputJsonValue },
      include: { channels: true },
    });
    return toClientProfile(client);
  }

  async updateDpaProfile(clientId: string, input: DpaProfileInput): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }

    const existingCompliance = toComplianceProfile(existing.complianceProfile);
    const complianceProfile: ClientComplianceProfile = {
      ...existingCompliance,
      dpa: {
        status: input.status,
        templateUrl: input.templateUrl,
        sentAt: input.sentAt,
        signerName: input.signerName,
        signerEmail: input.signerEmail,
        signedAt: input.signedAt,
        countersignedAt: input.countersignedAt,
        countersignedPdfUrl: input.countersignedPdfUrl,
        notes: input.notes,
        updatedAt: new Date().toISOString(),
      },
    };

    const client = await prisma.client.update({
      where: { id: clientId },
      data: { complianceProfile: complianceProfile as unknown as Prisma.InputJsonValue },
      include: { channels: true },
    });
    return toClientProfile(client);
  }

  async updateProfile(clientId: string, input: ClientMutationInput): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }

    const onboardingProfile =
      input.onboardingProfile === undefined
        ? undefined
        : {
            ...(toOnboardingProfile(existing.onboardingProfile) ?? {}),
            ...input.onboardingProfile,
          };
    await prisma.client.update({
      where: { id: clientId },
      data: {
        businessName: input.businessName,
        pageId: input.pageId,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        ownerPhone: input.ownerPhone,
        businessCategory: input.businessCategory,
        defaultLanguage: input.defaultLanguage,
        tone: input.tone,
        whatsappPoc: input.whatsappPoc,
        digestEmail: input.digestEmail,
        onboardingStatus: input.onboardingStatus,
        onboardingProfile,
      },
    });

    if (input.pageId !== undefined) {
      await this.syncPrimaryMessengerChannel(clientId, input.pageId);
    }

    return this.findById(clientId);
  }

  async setStatus(clientId: string, status: ClientStatus): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    const existing = await prisma.client.findUnique({ where: { id: clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }

    const client = await prisma.client.update({
      where: { id: clientId },
      data: { status },
      include: { channels: true },
    });
    return toClientProfile(client);
  }

  async createChannel(clientId: string, input: ClientChannelInput): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    await this.findExistingClient(clientId);
    const shouldBePrimary = input.isPrimary ?? (await this.shouldAutoPrimary(clientId, input.channel));
    if (shouldBePrimary) {
      await prisma.clientChannel.updateMany({
        where: { clientId, channel: input.channel },
        data: { isPrimary: false },
      });
    }

    await prisma.clientChannel.create({
      data: {
        id: `channel-${randomUUID()}`,
        clientId,
        channel: input.channel,
        externalId: input.externalId.trim(),
        label: input.label?.trim() || defaultChannelLabel(input.channel),
        status: input.status ?? 'connected',
        isPrimary: shouldBePrimary,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.syncLegacyPageId(clientId);
    return this.findById(clientId);
  }

  async updateChannel(clientId: string, channelId: string, input: Partial<ClientChannelInput>): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    await this.findExistingClient(clientId);
    const existing = await prisma.clientChannel.findFirst({ where: { id: channelId, clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client channel not found: ${channelId}`);
    }

    const nextChannel = input.channel ?? (existing.channel as Channel);
    const shouldBePrimary = input.isPrimary ?? existing.isPrimary;
    if (shouldBePrimary) {
      await prisma.clientChannel.updateMany({
        where: { clientId, channel: nextChannel, id: { not: channelId } },
        data: { isPrimary: false },
      });
    }

    await prisma.clientChannel.update({
      where: { id: channelId },
      data: {
        channel: input.channel,
        externalId: input.externalId?.trim(),
        label: input.label?.trim(),
        status: input.status,
        isPrimary: shouldBePrimary,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await this.ensurePrimaryChannel(clientId, nextChannel);
    await this.syncLegacyPageId(clientId);
    return this.findById(clientId);
  }

  async deleteChannel(clientId: string, channelId: string): Promise<ClientProfile> {
    const prisma = this.requirePrisma();
    await this.findExistingClient(clientId);
    const existing = await prisma.clientChannel.findFirst({ where: { id: channelId, clientId } });
    if (existing === null) {
      throw new NotFoundException(`Client channel not found: ${channelId}`);
    }

    await prisma.clientChannel.delete({ where: { id: channelId } });
    await this.ensurePrimaryChannel(clientId, existing.channel as Channel);
    await this.syncLegacyPageId(clientId);
    return this.findById(clientId);
  }

  private async findExistingClient(clientId: string) {
    const client = await this.requirePrisma().client.findUnique({ where: { id: clientId } });
    if (client === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
    return client;
  }

  private async shouldAutoPrimary(clientId: string, channel: Channel): Promise<boolean> {
    const count = await this.requirePrisma().clientChannel.count({ where: { clientId, channel } });
    return count === 0;
  }

  private async ensurePrimaryChannel(clientId: string, channel: Channel): Promise<void> {
    const prisma = this.requirePrisma();
    const primary = await prisma.clientChannel.findFirst({ where: { clientId, channel, isPrimary: true } });
    if (primary !== null) return;

    const next = await prisma.clientChannel.findFirst({
      where: { clientId, channel, status: { not: 'disabled' } },
      orderBy: { createdAt: 'asc' },
    });
    if (next === null) return;

    await prisma.clientChannel.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  private async syncPrimaryMessengerChannel(clientId: string, pageId: string): Promise<void> {
    const normalizedPageId = pageId.trim();
    if (normalizedPageId === '' || normalizedPageId.endsWith('-page-pending')) {
      await this.syncLegacyPageId(clientId);
      return;
    }

    const prisma = this.requirePrisma();
    const primary = await prisma.clientChannel.findFirst({ where: { clientId, channel: 'messenger', isPrimary: true } });
    if (primary === null) {
      await prisma.clientChannel.create({
        data: {
          id: `channel-${randomUUID()}`,
          clientId,
          channel: 'messenger',
          externalId: normalizedPageId,
          label: 'Primary Facebook Page',
          status: 'connected',
          isPrimary: true,
        },
      });
      return;
    }

    await prisma.clientChannel.update({
      where: { id: primary.id },
      data: { externalId: normalizedPageId, status: 'connected' },
    });
  }

  private async syncLegacyPageId(clientId: string): Promise<void> {
    const prisma = this.requirePrisma();
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client === null) return;

    const primary = await prisma.clientChannel.findFirst({
      where: { clientId, channel: 'messenger', isPrimary: true, status: { not: 'disabled' } },
    });

    await prisma.client.update({
      where: { id: clientId },
      data: { pageId: primary?.externalId ?? `${clientId}-page-pending` },
    });
  }
}

function defaultChannelLabel(channel: Channel) {
  if (channel === 'messenger') return 'Facebook Page';
  if (channel === 'whatsapp') return 'WhatsApp number';
  return 'Web widget';
}
