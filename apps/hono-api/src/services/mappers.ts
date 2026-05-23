import type {
  Channel,
  ClientProfile,
  ConversationAutoQaGrade,
  ConversationLog,
  ConversationMessage,
  ConversationQaDefect,
  ConversationQaGrade,
  KnowledgeChangeRequest,
  KnowledgeChangeRequestEvent,
  KnowledgeEntry,
  KnowledgeEntryVersion,
  PromptProfile,
  PromptProfileVersion,
  Ticket,
  TicketComment,
  TicketEvent,
} from '@ai-front-desk/shared';

export function iso(value?: Date | string | null) {
  if (value === undefined || value === null) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

export function toClientProfile(client: {
  id: string;
  businessName: string;
  pageId: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  businessCategory?: string | null;
  onboardingStatus: string;
  onboardingProfile?: Record<string, unknown> | null;
  defaultLanguage: string;
  tone: string;
  escalationKeywords: string[];
  whatsappPoc?: string | null;
  digestEmail?: string | null;
}): ClientProfile {
  return {
    id: client.id,
    businessName: client.businessName,
    pageId: client.pageId,
    ownerName: client.ownerName ?? undefined,
    ownerEmail: client.ownerEmail ?? undefined,
    ownerPhone: client.ownerPhone ?? undefined,
    businessCategory: client.businessCategory ?? undefined,
    onboardingStatus: client.onboardingStatus,
    onboardingProfile: client.onboardingProfile ?? undefined,
    defaultLanguage:
      client.defaultLanguage === 'bangla' || client.defaultLanguage === 'english' || client.defaultLanguage === 'mixed'
        ? client.defaultLanguage
        : 'mixed',
    tone: client.tone,
    escalationKeywords: client.escalationKeywords,
    whatsappPoc: client.whatsappPoc ?? undefined,
    digestEmail: client.digestEmail ?? undefined,
  };
}

export function toTicket(ticket: {
  id: string;
  clientId: string;
  conversationId: string;
  assigneeId?: string | null;
  version: number;
  priority: string;
  status: string;
  reason: string;
  customerMessage: string;
  suggestedReply: string;
  salesRecoveredEstimate: number;
  createdAt: Date;
  updatedAt: Date;
}): Ticket {
  return {
    id: ticket.id,
    clientId: ticket.clientId,
    conversationId: ticket.conversationId,
    assigneeId: ticket.assigneeId ?? undefined,
    version: ticket.version,
    priority: ticket.priority as Ticket['priority'],
    status: ticket.status as Ticket['status'],
    reason: ticket.reason,
    customerMessage: ticket.customerMessage,
    suggestedReply: ticket.suggestedReply,
    salesRecoveredEstimate: ticket.salesRecoveredEstimate,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function toTicketEvent(event: {
  id: string;
  ticketId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}): TicketEvent {
  return {
    id: event.id,
    ticketId: event.ticketId,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toTicketComment(comment: {
  id: string;
  ticketId: string;
  body: string;
  authorId: string;
  createdAt: Date;
}): TicketComment {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    body: comment.body,
    authorId: comment.authorId,
    createdAt: comment.createdAt.toISOString(),
  };
}

export function toConversation(
  conversation: {
    id: string;
    clientId: string;
    channel: string;
    externalConversationId: string;
    externalSenderId: string;
    lastConfidence?: number | null;
    ticketId?: string | null;
    csatScore?: number | null;
    csatComment?: string | null;
    csatAt?: Date | null;
    qaGrade?: string | null;
    hallucinationFlag: boolean;
    gradedBy?: string | null;
    gradedAt?: Date | null;
    autoQaScore?: number | null;
    autoQaGrade?: string | null;
    autoQaDefects: string[];
    autoQaReason?: string | null;
    autoQaAt?: Date | null;
    autoQaVersion?: string | null;
  },
  messageRows: {
    id: string;
    direction: string;
    text: string;
    createdAt: Date;
  }[] = [],
): ConversationLog {
  return {
    id: conversation.id,
    clientId: conversation.clientId,
    channel: conversation.channel as Channel,
    externalConversationId: conversation.externalConversationId,
    externalSenderId: conversation.externalSenderId,
    lastConfidence: conversation.lastConfidence ?? undefined,
    ticketId: conversation.ticketId ?? undefined,
    csatScore: conversation.csatScore ?? undefined,
    csatComment: conversation.csatComment ?? undefined,
    csatAt: iso(conversation.csatAt),
    qaGrade: (conversation.qaGrade as ConversationQaGrade | null) ?? undefined,
    hallucinationFlag: conversation.hallucinationFlag,
    gradedBy: conversation.gradedBy ?? undefined,
    gradedAt: iso(conversation.gradedAt),
    autoQaScore: conversation.autoQaScore ?? undefined,
    autoQaGrade: (conversation.autoQaGrade as ConversationAutoQaGrade | null) ?? undefined,
    autoQaDefects: conversation.autoQaDefects as ConversationQaDefect[],
    autoQaReason: conversation.autoQaReason ?? undefined,
    autoQaAt: iso(conversation.autoQaAt),
    autoQaVersion: conversation.autoQaVersion ?? undefined,
    messages: messageRows.map((message): ConversationMessage => ({
      id: message.id,
      direction: message.direction as ConversationMessage['direction'],
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

export function toKnowledgeEntry(entry: {
  id: string;
  clientId: string;
  title: string;
  answer: string;
  keywords: string[];
  category?: string | null;
  confidenceBoost?: number | null;
  status: string;
  version: number;
  embeddingText?: string | null;
  embeddedAt?: Date | null;
  archivedAt?: Date | null;
  sourceTicketId?: string | null;
  templateKey?: string | null;
}): KnowledgeEntry {
  return {
    id: entry.id,
    clientId: entry.clientId,
    title: entry.title,
    answer: entry.answer,
    keywords: entry.keywords,
    category: entry.category ?? 'general',
    confidenceBoost: entry.confidenceBoost ?? undefined,
    status: entry.status as KnowledgeEntry['status'],
    version: entry.version,
    embeddingText: entry.embeddingText ?? undefined,
    embeddedAt: iso(entry.embeddedAt),
    archivedAt: iso(entry.archivedAt),
    sourceTicketId: entry.sourceTicketId ?? undefined,
    templateKey: entry.templateKey ?? undefined,
  };
}

export function toKnowledgeVersion(version: {
  id: string;
  entryId: string;
  clientId: string;
  version: number;
  title: string;
  answer: string;
  keywords: string[];
  category?: string | null;
  confidenceBoost?: number | null;
  status: string;
  action: string;
  actorId: string;
  createdAt: Date;
}): KnowledgeEntryVersion {
  return {
    id: version.id,
    entryId: version.entryId,
    clientId: version.clientId,
    version: version.version,
    title: version.title,
    answer: version.answer,
    keywords: version.keywords,
    category: version.category ?? 'general',
    confidenceBoost: version.confidenceBoost ?? undefined,
    status: version.status as KnowledgeEntryVersion['status'],
    action: version.action as KnowledgeEntryVersion['action'],
    actorId: version.actorId,
    createdAt: version.createdAt.toISOString(),
  };
}

export function toPromptProfile(profile: {
  id: string;
  clientId: string;
  name: string;
  systemInstructions: string;
  toneRules: string;
  escalationRules: string;
  forbiddenClaims: string;
  fallbackBehavior: string;
  status: string;
  version: number;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PromptProfile {
  return {
    id: profile.id,
    clientId: profile.clientId,
    name: profile.name,
    systemInstructions: profile.systemInstructions,
    toneRules: profile.toneRules,
    escalationRules: profile.escalationRules,
    forbiddenClaims: profile.forbiddenClaims,
    fallbackBehavior: profile.fallbackBehavior,
    status: profile.status as PromptProfile['status'],
    version: profile.version,
    archivedAt: iso(profile.archivedAt),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function toPromptVersion(version: {
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
  status: string;
  action: string;
  actorId: string;
  createdAt: Date;
}): PromptProfileVersion {
  return {
    id: version.id,
    profileId: version.profileId,
    clientId: version.clientId,
    version: version.version,
    name: version.name,
    systemInstructions: version.systemInstructions,
    toneRules: version.toneRules,
    escalationRules: version.escalationRules,
    forbiddenClaims: version.forbiddenClaims,
    fallbackBehavior: version.fallbackBehavior,
    status: version.status as PromptProfileVersion['status'],
    action: version.action as PromptProfileVersion['action'],
    actorId: version.actorId,
    createdAt: version.createdAt.toISOString(),
  };
}

export function toKnowledgeRequest(request: {
  id: string;
  clientId: string;
  targetEntryId?: string | null;
  requestType: string;
  status: string;
  urgency: string;
  proposedTitle: string;
  proposedAnswer: string;
  proposedKeywords: string[];
  proposedCategory: string;
  requesterNote?: string | null;
  reviewerNote?: string | null;
  clientVisibleMessage?: string | null;
  internalNote?: string | null;
  submittedBy: string;
  reviewedBy?: string | null;
  publishedEntryId?: string | null;
  currentEntrySnapshot?: Record<string, unknown> | null;
  decisionSnapshot?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  publishedAt?: Date | null;
  closedAt?: Date | null;
}): KnowledgeChangeRequest {
  return {
    id: request.id,
    clientId: request.clientId,
    targetEntryId: request.targetEntryId ?? undefined,
    requestType: request.requestType as KnowledgeChangeRequest['requestType'],
    status: request.status as KnowledgeChangeRequest['status'],
    urgency: request.urgency as KnowledgeChangeRequest['urgency'],
    proposedTitle: request.proposedTitle,
    proposedAnswer: request.proposedAnswer,
    proposedKeywords: request.proposedKeywords,
    proposedCategory: request.proposedCategory,
    requesterNote: request.requesterNote ?? undefined,
    reviewerNote: request.reviewerNote ?? undefined,
    clientVisibleMessage: request.clientVisibleMessage ?? undefined,
    internalNote: request.internalNote ?? undefined,
    submittedBy: request.submittedBy,
    reviewedBy: request.reviewedBy ?? undefined,
    publishedEntryId: request.publishedEntryId ?? undefined,
    currentEntrySnapshot: request.currentEntrySnapshot ?? undefined,
    decisionSnapshot: request.decisionSnapshot ?? undefined,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    reviewedAt: iso(request.reviewedAt),
    publishedAt: iso(request.publishedAt),
    closedAt: iso(request.closedAt),
  };
}

export function toKnowledgeRequestEvent(event: {
  id: string;
  requestId: string;
  eventType: string;
  actorId: string;
  note?: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}): KnowledgeChangeRequestEvent {
  return {
    id: event.id,
    requestId: event.requestId,
    eventType: event.eventType,
    actorId: event.actorId,
    note: event.note ?? undefined,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
