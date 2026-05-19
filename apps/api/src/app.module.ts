import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiService } from './ai/ai.service';
import { ChannelSendService } from './channels/channel-send.service';
import { MessengerController } from './channels/messenger.controller';
import { MessengerSendService } from './channels/messenger-send.service';
import { MessengerSignatureService } from './channels/messenger-signature.service';
import { WebChatController } from './channels/web-chat.controller';
import { WhatsAppController } from './channels/whatsapp.controller';
import { WhatsAppSignatureService } from './channels/whatsapp-signature.service';
import { PilotClientService } from './clients/pilot-client.service';
import { ConversationController } from './conversations/conversation.controller';
import { ConversationRepository } from './conversations/conversation.repository';
import { ConversationService } from './conversations/conversation.service';
import { AutoQaService } from './conversations/auto-qa.service';
import { PrismaService } from './database/prisma.service';
import { HealthController } from './health/health.controller';
import { InternalUsersController } from './internal-users/internal-users.controller';
import { ClientAuthController } from './clients/client-auth.controller';
import { ClientAuthService } from './clients/client-auth.service';
import { ClientController } from './clients/client.controller';
import { ClientDashboardService } from './clients/client-dashboard.service';
import { DigestDeliveryService } from './clients/digest-delivery.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { KnowledgeController } from './knowledge/knowledge.controller';
import { EmbeddingService } from './knowledge/embedding.service';
import { IndustryTemplateController } from './knowledge/industry-template.controller';
import { IndustryTemplateService } from './knowledge/industry-template.service';
import { KnowledgeImportService } from './knowledge/knowledge-import.service';
import { KnowledgeChangeRequestController } from './knowledge/knowledge-change-request.controller';
import { KnowledgeChangeRequestService } from './knowledge/knowledge-change-request.service';
import { AuthCodeDeliveryService } from './notifications/auth-code-delivery.service';
import { EmailDeliveryService } from './notifications/email-delivery.service';
import { UrgentTicketNotificationService } from './notifications/urgent-ticket-notification.service';
import { StructuredLoggerService } from './observability/structured-logger.service';
import { PromptProfileController } from './prompts/prompt-profile.controller';
import { PromptProfileService } from './prompts/prompt-profile.service';
import { TicketController } from './tickets/ticket.controller';
import { TicketService } from './tickets/ticket.service';
import { ApiAuthGuard } from './security/api-auth.guard';
import { RateLimitGuard } from './security/rate-limit.guard';

@Module({
  controllers: [
    ClientController,
    ClientAuthController,
    ConversationController,
    HealthController,
    IndustryTemplateController,
    InternalUsersController,
    KnowledgeChangeRequestController,
    KnowledgeController,
    MessengerController,
    WebChatController,
    WhatsAppController,
    PromptProfileController,
    TicketController,
  ],
  providers: [
    AiService,
    AutoQaService,
    ChannelSendService,
    ConversationRepository,
    ConversationService,
    ClientAuthService,
    ClientDashboardService,
    DigestDeliveryService,
    EmbeddingService,
    IndustryTemplateService,
    AuthCodeDeliveryService,
    EmailDeliveryService,
    KnowledgeChangeRequestService,
    KnowledgeImportService,
    KnowledgeService,
    MessengerSendService,
    MessengerSignatureService,
    WhatsAppSignatureService,
    PilotClientService,
    PromptProfileService,
    PrismaService,
    StructuredLoggerService,
    TicketService,
    UrgentTicketNotificationService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiAuthGuard,
    },
  ],
})
export class AppModule {}
