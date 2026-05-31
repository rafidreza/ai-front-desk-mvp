import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuditLogController } from './audit/audit-log.controller';
import { AuditLogService } from './audit/audit-log.service';
import { AiService } from './ai/ai.service';
import { ChannelHealthController } from './channels/channel-health.controller';
import { ChannelHealthService } from './channels/channel-health.service';
import { ChannelSendService } from './channels/channel-send.service';
import { MessengerController } from './channels/messenger.controller';
import { MessengerSendService } from './channels/messenger-send.service';
import { MessengerSignatureService } from './channels/messenger-signature.service';
import { WebChatController } from './channels/web-chat.controller';
import { WhatsAppController } from './channels/whatsapp.controller';
import { WhatsAppSignatureService } from './channels/whatsapp-signature.service';
import { WhatsAppTemplateController } from './channels/whatsapp-template.controller';
import { WhatsAppTemplateService } from './channels/whatsapp-template.service';
import { PilotClientService } from './clients/pilot-client.service';
import { AutoReplyController } from './clients/auto-reply.controller';
import { AutoReplyService } from './clients/auto-reply.service';
import { ConversationController } from './conversations/conversation.controller';
import { ConversationRepository } from './conversations/conversation.repository';
import { ConversationService } from './conversations/conversation.service';
import { AutoQaService } from './conversations/auto-qa.service';
import { PrismaService } from './database/prisma.service';
import { ExternalDataService } from './external-data/external-data.service';
import { HealthController } from './health/health.controller';
import { InternalAuthController } from './internal-users/internal-auth.controller';
import { InternalAuthService } from './internal-users/internal-auth.service';
import { InternalUsersController } from './internal-users/internal-users.controller';
import { ClientAuthController } from './clients/client-auth.controller';
import { ClientAuthService } from './clients/client-auth.service';
import { ClientController } from './clients/client.controller';
import { ClientDashboardService } from './clients/client-dashboard.service';
import { ConversionChecklistService } from './clients/conversion-checklist.service';
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
import { ErrorReporterService } from './observability/error-reporter.service';
import { ErrorReportingFilter } from './observability/error-reporting.filter';
import { PromptProfileController } from './prompts/prompt-profile.controller';
import { PromptProfileService } from './prompts/prompt-profile.service';
import { BlockedSenderController } from './customers/blocked-sender.controller';
import { BlockedSenderService } from './customers/blocked-sender.service';
import { TestCustomerController } from './customers/test-customer.controller';
import { TestCustomerService } from './customers/test-customer.service';
import { TagController } from './tags/tag.controller';
import { TagService } from './tags/tag.service';
import { TicketController } from './tickets/ticket.controller';
import { TicketService } from './tickets/ticket.service';
import { ApiAuthGuard } from './security/api-auth.guard';
import { RateLimitGuard } from './security/rate-limit.guard';

@Module({
  controllers: [
    AuditLogController,
    ClientController,
    ClientAuthController,
    AutoReplyController,
    ChannelHealthController,
    ConversationController,
    HealthController,
    IndustryTemplateController,
    InternalAuthController,
    InternalUsersController,
    KnowledgeChangeRequestController,
    KnowledgeController,
    MessengerController,
    WebChatController,
    WhatsAppController,
    WhatsAppTemplateController,
    PromptProfileController,
    BlockedSenderController,
    TagController,
    TestCustomerController,
    TicketController,
  ],
  providers: [
    AiService,
    AuditLogService,
    AutoQaService,
    AutoReplyService,
    ChannelHealthService,
    ChannelSendService,
    ConversationRepository,
    ConversationService,
    ClientAuthService,
    ClientDashboardService,
    ConversionChecklistService,
    DigestDeliveryService,
    EmbeddingService,
    ErrorReporterService,
    ExternalDataService,
    IndustryTemplateService,
    InternalAuthService,
    AuthCodeDeliveryService,
    EmailDeliveryService,
    KnowledgeChangeRequestService,
    KnowledgeImportService,
    KnowledgeService,
    MessengerSendService,
    MessengerSignatureService,
    WhatsAppSignatureService,
    WhatsAppTemplateService,
    PilotClientService,
    PromptProfileService,
    PrismaService,
    StructuredLoggerService,
    BlockedSenderService,
    TagService,
    TestCustomerService,
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
    {
      provide: APP_FILTER,
      useClass: ErrorReportingFilter,
    },
  ],
})
export class AppModule {}
