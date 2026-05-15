import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PilotClientService } from './pilot-client.service';
import { ClientDashboardService } from './client-dashboard.service';

const SignupSchema = z.object({
  businessName: z.string().trim().min(2),
  pageId: z.string().trim().min(2).optional(),
  ownerName: z.string().trim().min(2).optional(),
  ownerEmail: z.string().trim().email().optional(),
  ownerPhone: z.string().trim().min(5).optional(),
  businessCategory: z.string().trim().min(2).optional(),
  defaultLanguage: z.enum(['bangla', 'english', 'mixed']).optional(),
  tone: z.string().trim().min(5).optional(),
  whatsappPoc: z.string().trim().min(5).optional(),
  digestEmail: z.string().trim().email().optional(),
});

const CsatSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

@Controller('clients')
export class ClientController {
  constructor(
    private readonly clients: PilotClientService,
    private readonly dashboard: ClientDashboardService,
  ) {}

  @Get()
  async listClients() {
    return { clients: await this.clients.list() };
  }

  @Post('signup')
  async signup(@Body() body: unknown) {
    const parsed = SignupSchema.parse(body);
    return { client: await this.clients.create(parsed) };
  }

  @Get(':clientId/dashboard')
  async getDashboard(@Param('clientId') clientId: string) {
    return this.dashboard.getDashboard(clientId);
  }

  @Get(':clientId/digests/:cadence/preview')
  async getDigestPreview(@Param('clientId') clientId: string, @Param('cadence') cadence: string) {
    return this.dashboard.getDigestPreview(clientId, cadence === 'weekly' ? 'weekly' : 'daily');
  }

  @Patch(':clientId/conversations/:conversationId/csat')
  async captureCsat(
    @Param('clientId') clientId: string,
    @Param('conversationId') conversationId: string,
    @Body() body: unknown,
  ) {
    const parsed = CsatSchema.parse(body);
    return {
      conversation: await this.dashboard.captureCsat({
        clientId,
        conversationId,
        score: parsed.score,
        comment: parsed.comment,
      }),
    };
  }

  @Get(':clientId/tickets')
  async listClientTickets(@Param('clientId') clientId: string, @Query('status') status?: string) {
    return { tickets: await this.dashboard.listClientTickets(clientId, status) };
  }
}
