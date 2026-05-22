import type { Context } from 'hono';
import type { AppBindings } from '../db/client';
import { requireDb } from '../db/client';
import { AiService } from './ai';
import { ClientAuthService } from './auth';
import { ClientService, DashboardService } from './clients';
import { ConversationRepository, ConversationService, TicketService } from './conversations';
import { AuthCodeDeliveryService, ChannelSendService, EmailDeliveryService, UrgentTicketNotificationService } from './delivery';
import { InternalUsersService } from './internal-users';
import { KnowledgeChangeRequestService, KnowledgeImportService, KnowledgeService } from './knowledge';
import { LoggerService } from './logger';
import { PromptProfileService } from './prompts';
import { IndustryTemplateService } from './templates';

export function createServices(c: Context<AppBindings>) {
  const db = requireDb(c);
  const logger = new LoggerService();
  const clients = new ClientService(db, c.env);
  const dashboard = new DashboardService(db, clients);
  const knowledge = new KnowledgeService(db);
  const prompts = new PromptProfileService(db);
  const repository = new ConversationRepository(db);
  const ticketService = new TicketService(repository, knowledge, logger);
  const channelSend = new ChannelSendService(c.env, logger);
  const email = new EmailDeliveryService(c.env, logger);
  const authDelivery = new AuthCodeDeliveryService(email, channelSend);
  const auth = new ClientAuthService(db, c.env, clients, authDelivery);
  const urgent = new UrgentTicketNotificationService(channelSend);
  const conversations = new ConversationService(
    new AiService(c.env),
    clients,
    knowledge,
    repository,
    ticketService,
    prompts,
    channelSend,
    logger,
    c.env.ENABLE_P1_WHATSAPP_PINGS === 'false' ? undefined : urgent,
  );
  const imports = new KnowledgeImportService(knowledge, c.env);
  const knowledgeRequests = new KnowledgeChangeRequestService(db, knowledge);
  const templates = new IndustryTemplateService(knowledge);
  const internalUsers = new InternalUsersService(db);

  return {
    auth,
    channelSend,
    clients,
    conversations,
    dashboard,
    imports,
    internalUsers,
    knowledge,
    knowledgeRequests,
    prompts,
    repository,
    templates,
    tickets: ticketService,
  };
}
