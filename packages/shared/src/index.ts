export const PRODUCT_NAME = 'AI Front Desk';

export type Channel = 'messenger' | 'whatsapp' | 'web';

export type TicketPriority = 'P1' | 'P2' | 'P3';

export type TicketStatus = 'open' | 'assigned' | 'waiting_client' | 'resolved';

export type ConversationQaGrade = 'good' | 'bad';

export type ConversationAutoQaGrade = 'pass' | 'review' | 'fail';

export type ConversationQaDefect =
  | 'low_confidence'
  | 'no_knowledge_match'
  | 'hallucination_risk'
  | 'escalation_needed'
  | 'escalation_miss'
  | 'incomplete_answer'
  | 'tone_risk';

export type CalibrationQueueFilter =
  | 'needs_review'
  | 'failed'
  | 'hallucination'
  | 'escalation'
  | 'ungraded'
  | 'all';

export interface ClientProfile {
  id: string;
  businessName: string;
  pageId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessCategory?: string;
  onboardingStatus: string;
  defaultLanguage: 'bangla' | 'english' | 'mixed';
  tone: string;
  escalationKeywords: string[];
  whatsappPoc?: string;
  digestEmail?: string;
}

export interface KnowledgeEntry {
  id: string;
  clientId: string;
  title: string;
  answer: string;
  keywords: string[];
  confidenceBoost?: number;
  status: 'draft' | 'active' | 'archived';
  version: number;
  embeddingText?: string;
  embeddedAt?: string;
  archivedAt?: string;
  sourceTicketId?: string;
  templateKey?: string;
}

export interface KnowledgeEntryVersion {
  id: string;
  entryId: string;
  clientId: string;
  version: number;
  title: string;
  answer: string;
  keywords: string[];
  confidenceBoost?: number;
  status: KnowledgeEntry['status'];
  action: 'baseline' | 'created' | 'updated' | 'published' | 'archived' | 'rollback';
  actorId: string;
  createdAt: string;
}

export interface KnowledgeImportFileInput {
  fileName: string;
  contentType?: string;
  base64: string;
}

export interface KnowledgeImportDraft {
  entry: KnowledgeEntry;
  sourceFileName: string;
  sourceType: string;
}

export interface KnowledgeImportSkippedFile {
  fileName: string;
  reason: string;
}

export interface KnowledgeImportResult {
  imported: KnowledgeImportDraft[];
  skipped: KnowledgeImportSkippedFile[];
  extractedCharacters: number;
}

export interface PromptProfile {
  id: string;
  clientId: string;
  name: string;
  systemInstructions: string;
  toneRules: string;
  escalationRules: string;
  forbiddenClaims: string;
  fallbackBehavior: string;
  status: 'draft' | 'active' | 'archived';
  version: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptProfileVersion {
  id: string;
  profileId: string;
  clientId: string;
  version: number;
  name: string;
  systemInstructions: string;
  toneRules: string;
  escalationRules: string;
  forbiddenClaims: string;
  fallbackBehavior: string;
  status: PromptProfile['status'];
  action: 'baseline' | 'created' | 'updated' | 'published' | 'archived' | 'rollback';
  actorId: string;
  createdAt: string;
}

export interface IncomingMessage {
  id: string;
  clientId: string;
  channel: Channel;
  externalConversationId: string;
  externalSenderId: string;
  text: string;
  receivedAt: string;
}

export interface AgentReply {
  text: string;
  confidence: number;
  matchedKnowledgeIds: string[];
  shouldEscalate: boolean;
  escalationReason?: string;
}

export interface ConversationMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  text: string;
  createdAt: string;
}

export interface ConversationLog {
  id: string;
  clientId: string;
  channel: Channel;
  externalConversationId: string;
  externalSenderId: string;
  messages: ConversationMessage[];
  lastConfidence?: number;
  ticketId?: string;
  csatScore?: number;
  csatComment?: string;
  csatAt?: string;
  qaGrade?: ConversationQaGrade;
  hallucinationFlag: boolean;
  gradedBy?: string;
  gradedAt?: string;
  autoQaScore?: number;
  autoQaGrade?: ConversationAutoQaGrade;
  autoQaDefects: ConversationQaDefect[];
  autoQaReason?: string;
  autoQaAt?: string;
  autoQaVersion?: string;
}

export interface CalibrationQueueSummary {
  total: number;
  ungraded: number;
  failed: number;
  review: number;
  hallucinationRisk: number;
  escalationRisk: number;
}

export interface CalibrationQueueResult {
  filter: CalibrationQueueFilter;
  conversations: ConversationLog[];
  summary: CalibrationQueueSummary;
}

export interface Ticket {
  id: string;
  clientId: string;
  conversationId: string;
  assigneeId?: string;
  version: number;
  priority: TicketPriority;
  status: TicketStatus;
  reason: string;
  customerMessage: string;
  suggestedReply: string;
  salesRecoveredEstimate: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketEvent {
  id: string;
  ticketId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  comments: TicketComment[];
}

export interface ApiHealth {
  status: string;
  database: {
    enabled: boolean;
    ok: boolean;
    latencyMs?: number;
    error?: string;
  };
}

export interface InternalUser {
  id: string;
  label: string;
}

export interface ClientDashboardSummary {
  client: ClientProfile;
  totals: {
    conversations: number;
    tickets: number;
    openTickets: number;
    resolvedTickets: number;
    p1Tickets: number;
    containmentRate: number;
    averageConfidence: number;
    averageCsat: number | null;
    salesRecoveredEstimate: number;
  };
  recentTickets: Ticket[];
  recentConversations: ConversationLog[];
}
