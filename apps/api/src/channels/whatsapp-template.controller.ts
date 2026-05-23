import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { WhatsAppTemplateService } from './whatsapp-template.service';

const WhatsAppTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  languageCode: z.string().trim().min(2).max(20).optional(),
  category: z.string().trim().min(2).max(80).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  body: z.string().trim().min(2).max(2000),
  rejectionReason: z.string().trim().max(500).optional(),
  lastSyncedAt: z.string().datetime().optional(),
});

@Controller('clients/:clientId/whatsapp/templates')
export class WhatsAppTemplateController {
  constructor(private readonly templates: WhatsAppTemplateService) {}

  @Get()
  async listTemplates(@Param('clientId') clientId: string) {
    return { templates: await this.templates.list(clientId) };
  }

  @Post()
  async saveTemplate(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = WhatsAppTemplateSchema.parse(body);
    return { template: await this.templates.save(clientId, parsed) };
  }

  @Delete(':templateId')
  async deleteTemplate(@Param('clientId') clientId: string, @Param('templateId') templateId: string) {
    await this.templates.delete(clientId, templateId);
    return { ok: true };
  }
}
