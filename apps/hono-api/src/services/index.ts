import type { Context } from 'hono';
import type { AppBindings } from '../db/client';
import { requireDb } from '../db/client';
import { AiService } from './ai';
import { ClientAuthService } from './auth';
import { ChannelAdminService } from './channel-admin';
import { ActionGovernanceService, ConnectorActionExecutor } from './action-governance';
import { AnchorConsoleService } from './anchor-console';
import { AuditService } from './audit';
import { CallPersistenceService } from './call-persistence';
import { ClientService, DashboardService } from './clients';
import { ConnectorFrameworkService } from './connectors';
import { EscalationService } from './escalation';
import { GroundednessService } from './groundedness';
import { InteractionScoringService } from './interaction-scoring';
import { ConversationRepository, ConversationService, TicketService } from './conversations';
import { AuthCodeDeliveryService, ChannelSendService, EmailDeliveryService, UrgentTicketNotificationService } from './delivery';
import { InternalUsersService } from './internal-users';
import { KnowledgeChangeRequestService, KnowledgeImportService, KnowledgeService } from './knowledge';
import { LoggerService } from './logger';
import { MetaOAuthService } from './meta-oauth';
import { OnboardingService } from './onboarding';
import { OperatorAccessService } from './operator-access';
import { PromptProfileService } from './prompts';
import { QualificationService } from './qualification';
import { ReadLookupService } from './read-lookup';
import { IndustryTemplateService } from './templates';
import { CallService, TenantPhoneNumberService } from './telephony';
import { ThreadStateService } from './thread-state';
import { TenantSecretsService } from './tenant-secrets';
import { WidgetVoiceService } from './widget-voice';
import {
  tenantSecretEncryptionKey,
  voiceRuntimeUrl,
  webrtcIceServers,
  widgetVoiceEnabled,
  widgetVoiceMaxDurationS,
  widgetVoiceTokenSecret,
  widgetVoiceTokenTtlS,
} from '../env';

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
  const metaOAuth = new MetaOAuthService(db, c.env);
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
    c.env,
  );
  const imports = new KnowledgeImportService(knowledge, c.env);
  const knowledgeRequests = new KnowledgeChangeRequestService(db, knowledge);
  const templates = new IndustryTemplateService(knowledge);
  const internalUsers = new InternalUsersService(db);
  const channelAdmin = new ChannelAdminService(db, c.env);
  const operatorAccess = new OperatorAccessService(db);
  const tenantSecrets = new TenantSecretsService(db, tenantSecretEncryptionKey(c.env));
  const connectorFramework = new ConnectorFrameworkService(db, tenantSecrets);
  const actionGovernance = new ActionGovernanceService(db, new ConnectorActionExecutor(connectorFramework));
  const audit = new AuditService(db);
  const phoneNumbers = new TenantPhoneNumberService(db);
  // Call lifecycle events (started/ended/failed) flow straight into the audit trail (T27).
  const calls = new CallService(db, phoneNumbers, (event) =>
    audit.record(
      { clientId: event.clientId },
      { actorType: 'system', actorId: 'voice-runtime', eventType: event.type, payload: { callId: event.callId } },
    ),
  );
  const callPersistence = new CallPersistenceService(db);
  const threadState = new ThreadStateService(db);
  const readLookup = new ReadLookupService(actionGovernance, threadState);
  const groundedness = new GroundednessService(db);
  const qualification = new QualificationService(db);
  const escalation = new EscalationService(db, (event) =>
    audit.record(
      { clientId: event.clientId },
      { actorType: 'system', actorId: 'voice-runtime', eventType: event.type, payload: { escalationId: event.escalationId, reason: event.reason } },
    ),
  );
  const interactionScoring = new InteractionScoringService(db);
  const anchorConsole = new AnchorConsoleService(operatorAccess, escalation, actionGovernance, callPersistence, interactionScoring);
  const onboarding = new OnboardingService(db, phoneNumbers, qualification);
  // Web-widget voice is optional. Keep it disabled without requiring its production secret so
  // unrelated internal/admin API requests do not fail when voice calling is not being launched.
  const isWidgetVoiceEnabled = widgetVoiceEnabled(c.env);
  const widgetVoice = new WidgetVoiceService(
    {
      enabled: isWidgetVoiceEnabled,
      secret: isWidgetVoiceEnabled ? widgetVoiceTokenSecret(c.env) : 'disabled-widget-voice-token-secret',
      runtimeUrl: voiceRuntimeUrl(c.env),
      iceServers: webrtcIceServers(c.env),
      tokenTtlS: widgetVoiceTokenTtlS(c.env),
      maxDurationS: widgetVoiceMaxDurationS(c.env),
    },
    { get: async (clientId) => clients.findById(clientId).catch(() => null) },
  );

  return {
    actionGovernance,
    anchorConsole,
    audit,
    auth,
    callPersistence,
    calls,
    channelAdmin,
    connectorFramework,
    channelSend,
    clients,
    conversations,
    dashboard,
    escalation,
    groundedness,
    imports,
    interactionScoring,
    internalUsers,
    knowledge,
    knowledgeRequests,
    metaOAuth,
    onboarding,
    operatorAccess,
    phoneNumbers,
    prompts,
    qualification,
    readLookup,
    repository,
    templates,
    tenantSecrets,
    threadState,
    tickets: ticketService,
    widgetVoice,
  };
}
