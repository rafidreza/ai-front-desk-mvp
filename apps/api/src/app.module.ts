import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AiService } from './ai/ai.service';
import { MessengerController } from './channels/messenger.controller';
import { MessengerSendService } from './channels/messenger-send.service';
import { MessengerSignatureService } from './channels/messenger-signature.service';
import { PilotClientService } from './clients/pilot-client.service';
import { ConversationController } from './conversations/conversation.controller';
import { ConversationRepository } from './conversations/conversation.repository';
import { ConversationService } from './conversations/conversation.service';
import { PrismaService } from './database/prisma.service';
import { HealthController } from './health/health.controller';
import { InternalUsersController } from './internal-users/internal-users.controller';
import { ClientController } from './clients/client.controller';
import { ClientDashboardService } from './clients/client-dashboard.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { KnowledgeController } from './knowledge/knowledge.controller';
import { StructuredLoggerService } from './observability/structured-logger.service';
import { TicketController } from './tickets/ticket.controller';
import { TicketService } from './tickets/ticket.service';
import { ApiAuthGuard } from './security/api-auth.guard';
import { RateLimitGuard } from './security/rate-limit.guard';

@Module({
  controllers: [
    ClientController,
    ConversationController,
    HealthController,
    InternalUsersController,
    KnowledgeController,
    MessengerController,
    TicketController,
  ],
  providers: [
    AiService,
    ConversationRepository,
    ConversationService,
    ClientDashboardService,
    KnowledgeService,
    MessengerSendService,
    MessengerSignatureService,
    PilotClientService,
    PrismaService,
    StructuredLoggerService,
    TicketService,
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
