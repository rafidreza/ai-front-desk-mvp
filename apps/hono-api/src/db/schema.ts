import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const vector = customType<{ data: string }>({
  dataType() {
    return 'vector';
  },
});

export const ticketPriorityEnum = pgEnum('TicketPriority', ['P1', 'P2', 'P3']);
export const ticketStatusEnum = pgEnum('TicketStatus', ['open', 'assigned', 'waiting_client', 'resolved']);

export const clients = pgTable(
  'Client',
  {
    id: text('id').primaryKey(),
    businessName: text('businessName').notNull(),
    pageId: text('pageId').notNull(),
    ownerName: text('ownerName'),
    ownerEmail: text('ownerEmail'),
    ownerPhone: text('ownerPhone'),
    businessCategory: text('businessCategory'),
    onboardingStatus: text('onboardingStatus').notNull().default('draft'),
    defaultLanguage: text('defaultLanguage').notNull(),
    tone: text('tone').notNull(),
    escalationKeywords: text('escalationKeywords').array().notNull(),
    whatsappPoc: text('whatsappPoc'),
    digestEmail: text('digestEmail'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    pageIdUnique: uniqueIndex('Client_pageId_key').on(table.pageId),
  }),
);

export const clientAuthChallenges = pgTable(
  'ClientAuthChallenge',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    destination: text('destination').notNull(),
    codeHash: text('codeHash').notNull(),
    expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
    consumedAt: timestamp('consumedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('ClientAuthChallenge_clientId_idx').on(table.clientId),
    destinationIdx: index('ClientAuthChallenge_destination_idx').on(table.destination),
    expiresAtIdx: index('ClientAuthChallenge_expiresAt_idx').on(table.expiresAt),
  }),
);

export const internalUsers = pgTable(
  'InternalUser',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull(),
    email: text('email'),
    role: text('role').notNull().default('support'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex('InternalUser_email_key').on(table.email),
    statusIdx: index('InternalUser_status_idx').on(table.status),
    roleIdx: index('InternalUser_role_idx').on(table.role),
  }),
);

export const knowledgeEntries = pgTable(
  'KnowledgeEntry',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    answer: text('answer').notNull(),
    keywords: text('keywords').array().notNull(),
    category: text('category').notNull().default('general'),
    confidenceBoost: doublePrecision('confidenceBoost'),
    status: text('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    embedding: vector('embedding'),
    embeddingText: text('embeddingText'),
    embeddedAt: timestamp('embeddedAt', { mode: 'date' }),
    archivedAt: timestamp('archivedAt', { mode: 'date' }),
    sourceTicketId: text('sourceTicketId'),
    templateKey: text('templateKey'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('KnowledgeEntry_clientId_idx').on(table.clientId),
    categoryIdx: index('KnowledgeEntry_clientId_category_idx').on(table.clientId, table.category),
    sourceTicketIdx: index('KnowledgeEntry_sourceTicketId_idx').on(table.sourceTicketId),
    templateKeyIdx: index('KnowledgeEntry_templateKey_idx').on(table.templateKey),
  }),
);

export const knowledgeEntryVersions = pgTable(
  'KnowledgeEntryVersion',
  {
    id: text('id').primaryKey(),
    entryId: text('entryId').notNull().references(() => knowledgeEntries.id, { onDelete: 'cascade' }),
    clientId: text('clientId').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    answer: text('answer').notNull(),
    keywords: text('keywords').array().notNull(),
    category: text('category').notNull().default('general'),
    confidenceBoost: doublePrecision('confidenceBoost'),
    status: text('status').notNull(),
    action: text('action').notNull(),
    actorId: text('actorId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    entryIdIdx: index('KnowledgeEntryVersion_entryId_idx').on(table.entryId),
    clientIdIdx: index('KnowledgeEntryVersion_clientId_idx').on(table.clientId),
    actionIdx: index('KnowledgeEntryVersion_action_idx').on(table.action),
  }),
);

export const knowledgeChangeRequests = pgTable(
  'KnowledgeChangeRequest',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    targetEntryId: text('targetEntryId').references(() => knowledgeEntries.id, { onDelete: 'set null' }),
    requestType: text('requestType').notNull(),
    status: text('status').notNull().default('submitted'),
    urgency: text('urgency').notNull().default('normal'),
    proposedTitle: text('proposedTitle').notNull(),
    proposedAnswer: text('proposedAnswer').notNull(),
    proposedKeywords: text('proposedKeywords').array().notNull().default(sql`ARRAY[]::text[]`),
    proposedCategory: text('proposedCategory').notNull().default('general'),
    requesterNote: text('requesterNote'),
    reviewerNote: text('reviewerNote'),
    clientVisibleMessage: text('clientVisibleMessage'),
    internalNote: text('internalNote'),
    submittedBy: text('submittedBy').notNull().default('client'),
    reviewedBy: text('reviewedBy'),
    publishedEntryId: text('publishedEntryId'),
    currentEntrySnapshot: jsonb('currentEntrySnapshot').$type<Record<string, unknown> | null>(),
    decisionSnapshot: jsonb('decisionSnapshot').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewedAt', { mode: 'date' }),
    publishedAt: timestamp('publishedAt', { mode: 'date' }),
    closedAt: timestamp('closedAt', { mode: 'date' }),
  },
  (table) => ({
    clientIdIdx: index('KnowledgeChangeRequest_clientId_idx').on(table.clientId),
    clientStatusIdx: index('KnowledgeChangeRequest_clientId_status_idx').on(table.clientId, table.status),
    targetEntryIdx: index('KnowledgeChangeRequest_targetEntryId_idx').on(table.targetEntryId),
    statusUrgencyIdx: index('KnowledgeChangeRequest_status_urgency_idx').on(table.status, table.urgency),
    createdAtIdx: index('KnowledgeChangeRequest_createdAt_idx').on(table.createdAt),
  }),
);

export const knowledgeChangeRequestEvents = pgTable(
  'KnowledgeChangeRequestEvent',
  {
    id: text('id').primaryKey(),
    requestId: text('requestId').notNull().references(() => knowledgeChangeRequests.id, { onDelete: 'cascade' }),
    eventType: text('eventType').notNull(),
    actorId: text('actorId').notNull(),
    note: text('note'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    requestIdIdx: index('KnowledgeChangeRequestEvent_requestId_idx').on(table.requestId),
    eventTypeIdx: index('KnowledgeChangeRequestEvent_eventType_idx').on(table.eventType),
    createdAtIdx: index('KnowledgeChangeRequestEvent_createdAt_idx').on(table.createdAt),
  }),
);

export const promptProfiles = pgTable(
  'PromptProfile',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    systemInstructions: text('systemInstructions').notNull(),
    toneRules: text('toneRules').notNull(),
    escalationRules: text('escalationRules').notNull(),
    forbiddenClaims: text('forbiddenClaims').notNull(),
    fallbackBehavior: text('fallbackBehavior').notNull(),
    status: text('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    archivedAt: timestamp('archivedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('PromptProfile_clientId_idx').on(table.clientId),
    clientStatusIdx: index('PromptProfile_clientId_status_idx').on(table.clientId, table.status),
  }),
);

export const promptProfileVersions = pgTable(
  'PromptProfileVersion',
  {
    id: text('id').primaryKey(),
    profileId: text('profileId').notNull().references(() => promptProfiles.id, { onDelete: 'cascade' }),
    clientId: text('clientId').notNull(),
    version: integer('version').notNull(),
    name: text('name').notNull(),
    systemInstructions: text('systemInstructions').notNull(),
    toneRules: text('toneRules').notNull(),
    escalationRules: text('escalationRules').notNull(),
    forbiddenClaims: text('forbiddenClaims').notNull(),
    fallbackBehavior: text('fallbackBehavior').notNull(),
    status: text('status').notNull(),
    action: text('action').notNull(),
    actorId: text('actorId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    profileIdIdx: index('PromptProfileVersion_profileId_idx').on(table.profileId),
    clientIdIdx: index('PromptProfileVersion_clientId_idx').on(table.clientId),
    actionIdx: index('PromptProfileVersion_action_idx').on(table.action),
  }),
);

export const conversations = pgTable(
  'Conversation',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    externalConversationId: text('externalConversationId').notNull(),
    externalSenderId: text('externalSenderId').notNull(),
    lastConfidence: doublePrecision('lastConfidence'),
    ticketId: text('ticketId'),
    csatScore: integer('csatScore'),
    csatComment: text('csatComment'),
    csatAt: timestamp('csatAt', { mode: 'date' }),
    qaGrade: text('qaGrade'),
    hallucinationFlag: boolean('hallucinationFlag').notNull().default(false),
    gradedBy: text('gradedBy'),
    gradedAt: timestamp('gradedAt', { mode: 'date' }),
    autoQaScore: doublePrecision('autoQaScore'),
    autoQaGrade: text('autoQaGrade'),
    autoQaDefects: text('autoQaDefects').array().notNull().default(sql`ARRAY[]::text[]`),
    autoQaReason: text('autoQaReason'),
    autoQaAt: timestamp('autoQaAt', { mode: 'date' }),
    autoQaVersion: text('autoQaVersion'),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    externalUnique: uniqueIndex('Conversation_clientId_channel_externalConversationId_key').on(
      table.clientId,
      table.channel,
      table.externalConversationId,
    ),
    clientIdIdx: index('Conversation_clientId_idx').on(table.clientId),
    autoQaIdx: index('Conversation_clientId_autoQaGrade_idx').on(table.clientId, table.autoQaGrade),
  }),
);

export const messages = pgTable(
  'Message',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversationId').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    direction: text('direction').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('Message_conversationId_idx').on(table.conversationId),
  }),
);

export const tickets = pgTable(
  'Ticket',
  {
    id: text('id').primaryKey(),
    clientId: text('clientId').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    conversationId: text('conversationId').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    assigneeId: text('assigneeId'),
    version: integer('version').notNull().default(0),
    priority: ticketPriorityEnum('priority').notNull(),
    status: ticketStatusEnum('status').notNull(),
    reason: text('reason').notNull(),
    customerMessage: text('customerMessage').notNull(),
    suggestedReply: text('suggestedReply').notNull(),
    salesRecoveredEstimate: doublePrecision('salesRecoveredEstimate').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('Ticket_clientId_idx').on(table.clientId),
    conversationIdIdx: index('Ticket_conversationId_idx').on(table.conversationId),
    assigneeIdIdx: index('Ticket_assigneeId_idx').on(table.assigneeId),
    priorityStatusIdx: index('Ticket_priority_status_idx').on(table.priority, table.status),
  }),
);

export const ticketEvents = pgTable(
  'TicketEvent',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticketId').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    eventType: text('eventType').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    ticketIdIdx: index('TicketEvent_ticketId_idx').on(table.ticketId),
  }),
);

export const ticketComments = pgTable(
  'TicketComment',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticketId').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    authorId: text('authorId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => ({
    ticketIdIdx: index('TicketComment_ticketId_idx').on(table.ticketId),
  }),
);

export const clientRelations = relations(clients, ({ many }) => ({
  conversations: many(conversations),
  tickets: many(tickets),
  knowledgeEntries: many(knowledgeEntries),
}));

export const conversationRelations = relations(conversations, ({ many, one }) => ({
  client: one(clients, { fields: [conversations.clientId], references: [clients.id] }),
  messages: many(messages),
  tickets: many(tickets),
}));

export const ticketRelations = relations(tickets, ({ many, one }) => ({
  client: one(clients, { fields: [tickets.clientId], references: [clients.id] }),
  conversation: one(conversations, { fields: [tickets.conversationId], references: [conversations.id] }),
  events: many(ticketEvents),
  comments: many(ticketComments),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
}));

export const ticketEventRelations = relations(ticketEvents, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketEvents.ticketId], references: [tickets.id] }),
}));

export const ticketCommentRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketComments.ticketId], references: [tickets.id] }),
}));

export const schema = {
  clients,
  clientAuthChallenges,
  internalUsers,
  knowledgeEntries,
  knowledgeEntryVersions,
  knowledgeChangeRequests,
  knowledgeChangeRequestEvents,
  promptProfiles,
  promptProfileVersions,
  conversations,
  messages,
  tickets,
  ticketEvents,
  ticketComments,
};

export type DbSchema = typeof schema;
