import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { ClientProfile } from '../types/domain';

type ClientLanguage = ClientProfile['defaultLanguage'];

function toClientProfile(client: {
  id: string;
  businessName: string;
  pageId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  businessCategory: string | null;
  onboardingStatus: string;
  defaultLanguage: string;
  tone: string;
  escalationKeywords: string[];
  whatsappPoc: string | null;
  digestEmail: string | null;
}): ClientProfile {
  const defaultLanguage: ClientLanguage =
    client.defaultLanguage === 'bangla' || client.defaultLanguage === 'english' || client.defaultLanguage === 'mixed'
      ? client.defaultLanguage
      : 'mixed';

  return {
    id: client.id,
    businessName: client.businessName,
    pageId: client.pageId,
    ownerName: client.ownerName ?? undefined,
    ownerEmail: client.ownerEmail ?? undefined,
    ownerPhone: client.ownerPhone ?? undefined,
    businessCategory: client.businessCategory ?? undefined,
    onboardingStatus: client.onboardingStatus,
    defaultLanguage,
    tone: client.tone,
    escalationKeywords: client.escalationKeywords,
    whatsappPoc: client.whatsappPoc ?? undefined,
    digestEmail: client.digestEmail ?? undefined,
  };
}

const pilotClientFallback: ClientProfile = {
  id: 'pilot-client',
  businessName: 'Pilot F-Commerce Seller',
  pageId: 'pilot-page',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
  escalationKeywords: ['refund', 'complaint', 'wrong product', 'cancel', 'human', 'রিফান্ড', 'অভিযোগ'],
  onboardingStatus: 'live',
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
    const clients = await this.prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
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
        defaultLanguage: input.defaultLanguage ?? 'mixed',
        tone: input.tone ?? 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
        escalationKeywords: ['refund', 'complaint', 'wrong product', 'cancel', 'human', 'রিফান্ড', 'অভিযোগ'],
        whatsappPoc: input.whatsappPoc,
        digestEmail: input.digestEmail ?? input.ownerEmail,
      },
    });

    return toClientProfile(client);
  }

  async findByPageId(pageId: string): Promise<ClientProfile> {
    if (this.prisma?.enabled !== true) {
      if (pageId === pilotClientFallback.pageId) return pilotClientFallback;
      throw new NotFoundException(`Client not found for page: ${pageId}`);
    }
    const client = await this.prisma.client.findUnique({ where: { pageId } });
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
        ],
      },
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
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (client !== null) {
      return toClientProfile(client);
    }

    throw new NotFoundException(`Client not found: ${clientId}`);
  }
}
