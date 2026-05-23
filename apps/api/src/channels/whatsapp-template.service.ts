import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { WhatsAppTemplate, WhatsAppTemplateStatus } from '../types/domain';

export interface WhatsAppTemplateInput {
  name: string;
  languageCode?: string;
  category?: string;
  status?: WhatsAppTemplateStatus;
  body: string;
  rejectionReason?: string;
  lastSyncedAt?: string;
}

function normalizeStatus(status: string): WhatsAppTemplateStatus {
  if (status === 'approved' || status === 'rejected' || status === 'pending') return status;
  return 'pending';
}

function toTemplate(template: {
  id: string;
  clientId: string;
  name: string;
  languageCode: string;
  category: string;
  status: string;
  body: string;
  rejectionReason: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): WhatsAppTemplate {
  return {
    id: template.id,
    clientId: template.clientId,
    name: template.name,
    languageCode: template.languageCode,
    category: template.category,
    status: normalizeStatus(template.status),
    body: template.body,
    rejectionReason: template.rejectionReason ?? undefined,
    lastSyncedAt: template.lastSyncedAt?.toISOString(),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

@Injectable()
export class WhatsAppTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(clientId: string): Promise<WhatsAppTemplate[]> {
    const templates = await this.prisma.whatsAppTemplate.findMany({
      where: { clientId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
    return templates.map(toTemplate);
  }

  async save(clientId: string, input: WhatsAppTemplateInput): Promise<WhatsAppTemplate> {
    await this.ensureClient(clientId);
    const name = input.name.trim();
    const languageCode = input.languageCode?.trim() || 'en_US';
    const template = await this.prisma.whatsAppTemplate.upsert({
      where: { clientId_name_languageCode: { clientId, name, languageCode } },
      update: {
        category: input.category?.trim() || 'utility',
        status: input.status ?? 'pending',
        body: input.body.trim(),
        rejectionReason: input.status === 'rejected' ? input.rejectionReason?.trim() : null,
        lastSyncedAt: input.lastSyncedAt === undefined ? undefined : new Date(input.lastSyncedAt),
      },
      create: {
        id: `wa-template-${randomUUID()}`,
        clientId,
        name,
        languageCode,
        category: input.category?.trim() || 'utility',
        status: input.status ?? 'pending',
        body: input.body.trim(),
        rejectionReason: input.status === 'rejected' ? input.rejectionReason?.trim() : null,
        lastSyncedAt: input.lastSyncedAt === undefined ? undefined : new Date(input.lastSyncedAt),
      },
    });
    return toTemplate(template);
  }

  async delete(clientId: string, templateId: string): Promise<void> {
    const deleted = await this.prisma.whatsAppTemplate.deleteMany({ where: { id: templateId, clientId } });
    if (deleted.count === 0) {
      throw new NotFoundException(`WhatsApp template not found: ${templateId}`);
    }
  }

  async ensureApproved(clientId: string, name: string, languageCode = 'en_US'): Promise<WhatsAppTemplate> {
    const template = await this.prisma.whatsAppTemplate.findUnique({
      where: { clientId_name_languageCode: { clientId, name, languageCode } },
    });
    if (template === null) {
      throw new BadRequestException(`WhatsApp template is not registered: ${name} (${languageCode})`);
    }
    if (template.status !== 'approved') {
      throw new BadRequestException(`WhatsApp template is ${template.status}: ${name} (${languageCode})`);
    }
    return toTemplate(template);
  }

  private async ensureClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (client === null) {
      throw new NotFoundException(`Client not found: ${clientId}`);
    }
  }
}
