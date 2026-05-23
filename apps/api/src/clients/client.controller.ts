import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PilotClientService } from './pilot-client.service';
import { ClientDashboardService } from './client-dashboard.service';
import { DigestDeliveryService } from './digest-delivery.service';
import { ExternalDataService } from '../external-data/external-data.service';

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

const ClientManagementSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  pageId: z.string().trim().min(2).max(180).optional(),
  ownerName: z.string().trim().min(2).max(120).optional(),
  ownerEmail: z.string().trim().email().optional(),
  ownerPhone: z.string().trim().min(5).max(80).optional(),
  businessCategory: z.string().trim().min(2).max(80).optional(),
  defaultLanguage: z.enum(['bangla', 'english', 'mixed']).optional(),
  tone: z.string().trim().min(5).max(500).optional(),
  whatsappPoc: z.string().trim().min(5).max(80).optional(),
  digestEmail: z.string().trim().email().optional(),
  onboardingStatus: z.enum(['signup_started', 'profile_complete', 'channels_complete', 'onboarding_complete', 'live']).optional(),
  onboardingProfile: z.object({
    focusChannels: z.array(z.enum(['whatsapp', 'facebook', 'website'])).min(1).max(3).optional(),
    websiteUrl: z.string().trim().url().optional(),
    facebookPageUrl: z.string().trim().url().optional(),
    whatsappSetup: z.enum(['self', 'assisted', 'skip']).optional(),
    facebookSetup: z.enum(['oauth', 'assisted', 'skip']).optional(),
  }).optional(),
});

const ClientStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const ClientChannelSchema = z.object({
  channel: z.enum(['messenger', 'whatsapp', 'web']),
  externalId: z.string().trim().min(2).max(180),
  label: z.string().trim().min(2).max(120).optional(),
  status: z.enum(['connected', 'available', 'needs_setup', 'disabled']).optional(),
  isPrimary: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ClientChannelPatchSchema = ClientChannelSchema.partial();

const OnboardingProfilePatchSchema = z.object({
  focusChannels: z.array(z.enum(['whatsapp', 'facebook', 'website'])).min(1).max(3).optional(),
  websiteUrl: z.string().trim().url().optional(),
  facebookPageUrl: z.string().trim().url().optional(),
  whatsappSetup: z.enum(['self', 'assisted', 'skip']).optional(),
  facebookSetup: z.enum(['oauth', 'assisted', 'skip']).optional(),
});

const OnboardingPatchSchema = z.object({
  businessCategory: z.string().trim().min(2).max(80).optional(),
  pageId: z.string().trim().min(2).max(180).optional(),
  whatsappPoc: z.string().trim().min(5).max(80).optional(),
  onboardingStatus: z.enum(['signup_started', 'profile_complete', 'channels_complete', 'onboarding_complete']).optional(),
  onboardingProfile: OnboardingProfilePatchSchema.optional(),
});

const CsatSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

const TicketStatusSchema = z.object({
  status: z.enum(['open', 'assigned', 'waiting_client', 'resolved']),
  expectedVersion: z.number().int().nonnegative().optional(),
});

const GoogleSheetSourceSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  sheetUrl: z.string().trim().url(),
  productsTabName: z.string().trim().min(1).max(80).optional(),
  ordersTabName: z.string().trim().min(1).max(80).optional(),
  syncIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  productFreshnessMinutes: z.number().int().min(1).max(1440).optional(),
  orderFreshnessMinutes: z.number().int().min(1).max(1440).optional(),
});

@Controller('clients')
export class ClientController {
  constructor(
    private readonly clients: PilotClientService,
    private readonly dashboard: ClientDashboardService,
    private readonly digests: DigestDeliveryService,
    private readonly externalData: ExternalDataService,
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

  @Post()
  async createClient(@Body() body: unknown) {
    const parsed = ClientManagementSchema.parse(body);
    return { client: await this.clients.createInternal(parsed) };
  }

  @Patch(':clientId')
  async updateClient(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = ClientManagementSchema.partial().parse(body);
    return { client: await this.clients.updateProfile(clientId, parsed) };
  }

  @Patch(':clientId/status')
  async updateClientStatus(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = ClientStatusSchema.parse(body);
    return { client: await this.clients.setStatus(clientId, parsed.status) };
  }

  @Post(':clientId/channels')
  async createClientChannel(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = ClientChannelSchema.parse(body);
    return { client: await this.clients.createChannel(clientId, parsed) };
  }

  @Patch(':clientId/channels/:channelId')
  async updateClientChannel(
    @Param('clientId') clientId: string,
    @Param('channelId') channelId: string,
    @Body() body: unknown,
  ) {
    const parsed = ClientChannelPatchSchema.parse(body);
    return { client: await this.clients.updateChannel(clientId, channelId, parsed) };
  }

  @Post(':clientId/channels/:channelId/delete')
  async deleteClientChannel(@Param('clientId') clientId: string, @Param('channelId') channelId: string) {
    return { client: await this.clients.deleteChannel(clientId, channelId) };
  }

  @Patch(':clientId/onboarding')
  async updateOnboarding(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = OnboardingPatchSchema.parse(body);
    return { client: await this.clients.updateOnboarding(clientId, parsed) };
  }

  @Get(':clientId/dashboard')
  async getDashboard(@Param('clientId') clientId: string) {
    return this.dashboard.getDashboard(clientId);
  }

  @Get(':clientId/digests/:cadence/preview')
  async getDigestPreview(@Param('clientId') clientId: string, @Param('cadence') cadence: string) {
    return this.dashboard.getDigestPreview(clientId, cadence === 'weekly' ? 'weekly' : 'daily');
  }

  @Post(':clientId/digests/:cadence/send')
  async sendDigest(@Param('clientId') clientId: string, @Param('cadence') cadence: string) {
    return {
      digest: await this.digests.sendDigest(clientId, cadence === 'weekly' ? 'weekly' : 'daily'),
    };
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

  @Get(':clientId/tickets/:ticketId')
  async getClientTicketDetail(@Param('clientId') clientId: string, @Param('ticketId') ticketId: string) {
    return this.dashboard.getClientTicketDetail(clientId, ticketId);
  }

  @Patch(':clientId/tickets/:ticketId/status')
  async updateClientTicketStatus(
    @Param('clientId') clientId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    const parsed = TicketStatusSchema.parse(body);
    return {
      ticket: await this.dashboard.updateClientTicketStatus({
        clientId,
        ticketId,
        status: parsed.status,
        expectedVersion: parsed.expectedVersion,
      }),
    };
  }

  @Get(':clientId/external-data/sources')
  async listExternalDataSources(@Param('clientId') clientId: string) {
    return { sources: await this.externalData.listSources(clientId) };
  }

  @Post(':clientId/external-data/google-sheet')
  async saveGoogleSheetSource(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = GoogleSheetSourceSchema.parse(body);
    return { source: await this.externalData.saveGoogleSheetSource(clientId, parsed) };
  }

  @Post(':clientId/external-data/sources/:sourceId/sync')
  async syncExternalDataSource(@Param('clientId') clientId: string, @Param('sourceId') sourceId: string) {
    return this.externalData.syncSource(clientId, sourceId);
  }

  @Get(':clientId/external-data/products')
  async listExternalProducts(@Param('clientId') clientId: string, @Query('sourceId') sourceId?: string) {
    return { products: await this.externalData.listProducts(clientId, sourceId) };
  }

  @Get(':clientId/external-data/orders')
  async listExternalOrders(@Param('clientId') clientId: string, @Query('sourceId') sourceId?: string) {
    return { orders: await this.externalData.listOrders(clientId, sourceId) };
  }
}
