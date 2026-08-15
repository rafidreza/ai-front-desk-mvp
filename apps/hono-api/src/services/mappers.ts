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
  complianceProfile?: Record<string, unknown> | null;
  lifecycleStage?: string | null;
  conversionChecklist?: unknown;
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
    status: 'active',
    ownerName: client.ownerName ?? undefined,
    ownerEmail: client.ownerEmail ?? undefined,
    ownerPhone: client.ownerPhone ?? undefined,
    businessCategory: client.businessCategory ?? undefined,
    onboardingStatus: client.onboardingStatus,
    onboardingProfile: client.onboardingProfile ?? undefined,
    lifecycleStage: toLifecycleStage(client.lifecycleStage),
    conversionChecklist: toConversionChecklist(client.conversionChecklist),
    complianceProfile: toComplianceProfile(client.complianceProfile),
    defaultLanguage: 'english',
    tone: client.tone,
    escalationKeywords: toEnglishKeywords(client.escalationKeywords),
    whatsappPoc: client.whatsappPoc ?? undefined,
    digestEmail: client.digestEmail ?? undefined,
  };
}

function toLifecycleStage(value: unknown): ClientProfile['lifecycleStage'] {
  if (
    value === 'lead' ||
    value === 'onboarding' ||
    value === 'kb_building' ||
    value === 'shadow' ||
    value === 'live' ||
    value === 'paid' ||
    value === 'churned'
  ) {
    return value;
  }
  return 'lead';
}

function toConversionChecklist(value: unknown): ClientProfile['conversionChecklist'] {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const source: 'auto' | 'manual' = item.source === 'auto' ? 'auto' : 'manual';
      return {
        id: String(item.id ?? ''),
        label: String(item.label ?? ''),
        done: item.done === true,
        source,
        detail: typeof item.detail === 'string' ? item.detail : undefined,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
      };
    })
    .filter((item) => item.id.length > 0 && item.label.length > 0);
}

function toComplianceProfile(value: unknown): ClientProfile['complianceProfile'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const profile = value as Record<string, unknown>;
  const hasDpa = profile.dpa !== null && typeof profile.dpa === 'object' && !Array.isArray(profile.dpa);
  const dpa = hasDpa ? (profile.dpa as Record<string, unknown>) : undefined;
  const retention = normalizeRetentionPolicy(profile.retention);
  if (dpa === undefined && retention === undefined) return undefined;
  return {
    dpa:
      dpa === undefined
        ? undefined
        : {
            status:
              dpa.status === 'sent' || dpa.status === 'signed' || dpa.status === 'countersigned'
                ? dpa.status
                : 'not_sent',
            templateUrl: stringOrUndefined(dpa.templateUrl),
            sentAt: stringOrUndefined(dpa.sentAt),
            signerName: stringOrUndefined(dpa.signerName),
            signerEmail: stringOrUndefined(dpa.signerEmail),
            signedAt: stringOrUndefined(dpa.signedAt),
            countersignedAt: stringOrUndefined(dpa.countersignedAt),
            countersignedPdfUrl: stringOrUndefined(dpa.countersignedPdfUrl),
            notes: stringOrUndefined(dpa.notes),
            updatedAt: stringOrUndefined(dpa.updatedAt),
          },
    retention,
  };
}

function normalizeRetentionPolicy(value: unknown): NonNullable<ClientProfile['complianceProfile']>['retention'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const policy = value as Record<string, unknown>;
  const days = typeof policy.days === 'number' && Number.isInteger(policy.days) ? policy.days : 90;
  return {
    mode: policy.mode === 'redact' ? 'redact' : 'disabled',
    days: Math.min(Math.max(days, 30), 3650),
    lastRunAt: stringOrUndefined(policy.lastRunAt),
    lastRunCount: typeof policy.lastRunCount === 'number' && Number.isInteger(policy.lastRunCount) ? policy.lastRunCount : undefined,
    updatedAt: stringOrUndefined(policy.updatedAt),
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

const displayTextReplacements: Array<[RegExp, string]> = [
  [
    /Thanks for your message\. Ami team ke check korte dicchi, tara shortly update debe\./gi,
    'Thanks for your message. I am checking this with the team and they will update you shortly.',
  ],
  [
    /Ami eta team er kache forward kore dicchi so they can confirm details\./gi,
    'I am forwarding this to the team so they can confirm the details.',
  ],
  [/Assalamu alaikum, ABC Telecom e call korar jonno dhonnobad\. Ki bhabe help korte pari\?/gi, 'Thank you for calling ABC Telecom. How can I help you?'],
  [/Dhakar inside delivery charge 80 taka, outside Dhaka 130 taka\./gi, 'Inside Dhaka delivery charge is BDT 80; outside Dhaka delivery charge is BDT 130.'],
  [/Dhakar inside delivery charge 80 taka\./gi, 'Inside Dhaka delivery charge is BDT 80.'],
  [/\bdelivery charge koto\?/gi, 'What is the delivery charge?'],
  [/\beta blue color e ache with gift wrap\?/gi, 'Is this available in blue with gift wrap?'],
  [/\beta gift wrap hobe\?/gi, 'Can this be gift wrapped?'],
  [/\bgift wrap ache\?/gi, 'Is gift wrap available?'],
  [/\bWrong size pathaise, ami refund chai\./gi, 'Wrong size was sent. I want a refund.'],
  [/\bAmi team ke check korte dicchi\./gi, 'I am checking this with the team.'],
  [/\b500 Mbps for 1500 taka per month; 1 Gbps for 2500 taka per month\./gi, '500 Mbps is BDT 1,500 per month; 1 Gbps is BDT 2,500 per month.'],
];

function toEnglishDisplayText(value: string) {
  return displayTextReplacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

const keywordTranslations: Record<string, string> = {
  koto: 'cost',
  kotodin: 'delivery time',
  kobe: 'delivery time',
  dam: 'price',
  'কত': 'cost',
  'দাম': 'price',
  'প্যাকেজ': 'package',
  'ডেলিভারি': 'delivery',
  'ডেলিভারি চার্জ': 'delivery charge',
  'ক্যাশ': 'cash',
  'পেমেন্ট': 'payment',
  'রিটার্ন': 'return',
  'এক্সচেঞ্জ': 'exchange',
  'রিফান্ড': 'refund',
  'অভিযোগ': 'complaint',
};

function toEnglishKeywords(keywords: string[]) {
  return Array.from(
    new Set(
      keywords
        .map((keyword) => keywordTranslations[keyword.toLowerCase()] ?? keywordTranslations[keyword] ?? keyword)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  );
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
    reason: toEnglishDisplayText(ticket.reason),
    customerMessage: toEnglishDisplayText(ticket.customerMessage),
    suggestedReply: toEnglishDisplayText(ticket.suggestedReply),
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
    body: toEnglishDisplayText(comment.body),
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
    attachmentType?: string | null;
    attachmentUrl?: string | null;
    transcript?: string | null;
    extractedText?: string | null;
    matchedProducts?: unknown;
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
      text: toEnglishDisplayText(message.text),
      attachmentType: message.attachmentType as ConversationMessage['attachmentType'],
      attachmentUrl: message.attachmentUrl ?? undefined,
      transcript: message.transcript === null || message.transcript === undefined ? undefined : toEnglishDisplayText(message.transcript),
      extractedText: message.extractedText === null || message.extractedText === undefined ? undefined : toEnglishDisplayText(message.extractedText),
      matchedProducts: Array.isArray(message.matchedProducts)
        ? message.matchedProducts as ConversationMessage['matchedProducts']
        : undefined,
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
    title: toEnglishDisplayText(entry.title),
    answer: toEnglishDisplayText(entry.answer),
    keywords: toEnglishKeywords(entry.keywords),
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
    title: toEnglishDisplayText(version.title),
    answer: toEnglishDisplayText(version.answer),
    keywords: toEnglishKeywords(version.keywords),
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
  aiProvider?: string | null;
  aiModel?: string | null;
  status: string;
  experimentEnabled?: boolean;
  experimentKey?: string | null;
  trafficWeight?: number;
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
    fallbackBehavior: toEnglishDisplayText(profile.fallbackBehavior),
    aiProvider: normalizeAiProvider(profile.aiProvider),
    aiModel: profile.aiModel ?? undefined,
    status: profile.status as PromptProfile['status'],
    experimentEnabled: profile.experimentEnabled ?? false,
    experimentKey: profile.experimentKey ?? undefined,
    trafficWeight: profile.trafficWeight ?? 100,
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
  aiProvider?: string | null;
  aiModel?: string | null;
  status: string;
  experimentEnabled?: boolean;
  experimentKey?: string | null;
  trafficWeight?: number;
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
    fallbackBehavior: toEnglishDisplayText(version.fallbackBehavior),
    aiProvider: normalizeAiProvider(version.aiProvider),
    aiModel: version.aiModel ?? undefined,
    status: version.status as PromptProfileVersion['status'],
    experimentEnabled: version.experimentEnabled ?? false,
    experimentKey: version.experimentKey ?? undefined,
    trafficWeight: version.trafficWeight ?? 100,
    action: version.action as PromptProfileVersion['action'],
    actorId: version.actorId,
    createdAt: version.createdAt.toISOString(),
  };
}

function normalizeAiProvider(value?: string | null): PromptProfile['aiProvider'] {
  if (value === 'anthropic' || value === 'openrouter' || value === 'local') return value;
  return undefined;
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
    proposedTitle: toEnglishDisplayText(request.proposedTitle),
    proposedAnswer: toEnglishDisplayText(request.proposedAnswer),
    proposedKeywords: toEnglishKeywords(request.proposedKeywords),
    proposedCategory: request.proposedCategory,
    requesterNote: request.requesterNote === null || request.requesterNote === undefined ? undefined : toEnglishDisplayText(request.requesterNote),
    reviewerNote: request.reviewerNote === null || request.reviewerNote === undefined ? undefined : toEnglishDisplayText(request.reviewerNote),
    clientVisibleMessage: request.clientVisibleMessage === null || request.clientVisibleMessage === undefined ? undefined : toEnglishDisplayText(request.clientVisibleMessage),
    internalNote: request.internalNote === null || request.internalNote === undefined ? undefined : toEnglishDisplayText(request.internalNote),
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
    note: event.note === null || event.note === undefined ? undefined : toEnglishDisplayText(event.note),
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
