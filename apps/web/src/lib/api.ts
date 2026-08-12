import {
  ApiHealth,
  AiProviderHealth,
  AuditLogEntry,
  CalibrationQueueFilter,
  CalibrationQueueResult,
  ClientDashboardSummary,
  ClientDpaProfile,
  ClientKnowledgeEntry,
  ClientRetentionPolicy,
  ClientProfile,
  ClientStatus,
  ConversationLog,
  ConversationQaGrade,
  ExternalDataSource,
  ExternalDataSyncRun,
  InternalUser,
  KnowledgeChangeRequest,
  KnowledgeChangeRequestReviewDetail,
  KnowledgeChangeRequestStatus,
  KnowledgeChangeRequestUrgency,
  KnowledgeEntry,
  KnowledgeEntryVersion,
  KnowledgeImportFileInput,
  KnowledgeImportResult,
  OrderRecord,
  BlockedSender,
  ConversationSearchResult,
  ProductRecord,
  TestCustomer,
  PromptProfile,
  PromptProfileVersion,
  Tag,
  TagColor,
  Ticket,
  TicketComment,
  TicketDetail,
  TicketStatus,
} from '@/types/domain';

const apiBaseUrl = '/api/backend';

function readApiErrorMessage(status: number, responseBody: string) {
  const fallback = `API request failed: ${status}`;
  if (responseBody.trim() === '') return fallback;

  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>;
    const message = parsed.message ?? parsed.error ?? parsed.detail;
    if (typeof message === 'string' && message.trim() !== '') {
      return `${message.trim()} (HTTP ${status})`;
    }
  } catch {
    if (!responseBody.trim().startsWith('<')) {
      return `${responseBody.trim()} (HTTP ${status})`;
    }
  }

  return fallback;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(readApiErrorMessage(response.status, await response.text()));
  }

  return response.json() as Promise<T>;
}

export async function getDatabaseHealth(): Promise<ApiHealth> {
  return apiFetch<ApiHealth>('/health/db');
}

export async function getAiProviderHealth(): Promise<AiProviderHealth> {
  return apiFetch<AiProviderHealth>('/health/ai');
}

export async function getConversations(): Promise<ConversationLog[]> {
  const data = await apiFetch<{ conversations: ConversationLog[] }>('/conversations');
  return data.conversations;
}

export async function getCalibrationQueue(
  filter: CalibrationQueueFilter = 'needs_review',
): Promise<CalibrationQueueResult> {
  return apiFetch<CalibrationQueueResult>(`/conversations/calibration-queue?filter=${filter}`);
}

export async function getTickets(): Promise<Ticket[]> {
  const data = await apiFetch<{ tickets: Ticket[] }>('/tickets');
  return data.tickets;
}

export async function getInternalUsers(): Promise<InternalUser[]> {
  const data = await apiFetch<{ users: InternalUser[] }>('/internal/users');
  return data.users;
}

export async function getAuditLogEntries(input: {
  clientId?: string;
  actorId?: string;
  entityType?: string;
  action?: string;
  limit?: number;
} = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (input.clientId !== undefined && input.clientId.trim() !== '') params.set('clientId', input.clientId.trim());
  if (input.actorId !== undefined && input.actorId.trim() !== '') params.set('actorId', input.actorId.trim());
  if (input.entityType !== undefined && input.entityType.trim() !== '') params.set('entityType', input.entityType.trim());
  if (input.action !== undefined && input.action.trim() !== '') params.set('action', input.action.trim());
  if (input.limit !== undefined) params.set('limit', String(input.limit));
  const query = params.toString();
  const data = await apiFetch<{ entries: AuditLogEntry[] }>(`/internal/audit-log${query === '' ? '' : `?${query}`}`);
  return data.entries;
}

export async function createInternalUser(input: {
  label: string;
  email?: string;
  role: string;
  password: string;
}): Promise<InternalUser> {
  const data = await apiFetch<{ user: InternalUser }>('/internal/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.user;
}

export async function getClients(): Promise<ClientProfile[]> {
  const data = await apiFetch<{ clients: ClientProfile[] }>('/clients');
  return data.clients;
}

export type ClientManagementInput = {
  businessName?: string;
  pageId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessCategory?: string;
  defaultLanguage?: ClientProfile['defaultLanguage'];
  tone?: string;
  whatsappPoc?: string;
  digestEmail?: string;
  onboardingStatus?: string;
  onboardingProfile?: ClientProfile['onboardingProfile'];
};

export async function createClientFromInternal(input: ClientManagementInput & { businessName: string }): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>('/clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.client;
}

export async function updateClientFromInternal(clientId: string, input: ClientManagementInput): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.client;
}

export async function updateClientStatus(clientId: string, status: ClientStatus): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return data.client;
}

export async function updateClientLifecycleStage(
  clientId: string,
  stage: import('@/types/domain').ClientLifecycleStage,
): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/lifecycle-stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });
  return data.client;
}

export async function updateClientConversionChecklist(
  clientId: string,
  items: import('@/types/domain').ConversionChecklistItem[],
): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/conversion-checklist`, {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
  return data.client;
}

export async function updateClientDpaProfile(
  clientId: string,
  input: Omit<ClientDpaProfile, 'updatedAt'>,
): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/compliance/dpa`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.client;
}

export async function updateClientRetentionPolicy(
  clientId: string,
  input: Pick<ClientRetentionPolicy, 'mode' | 'days'>,
): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/compliance/retention`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.client;
}

export async function previewClientRetentionCleanup(clientId: string): Promise<{
  cutoff: string;
  count: number;
  policy: ClientRetentionPolicy;
}> {
  return apiFetch<{ cutoff: string; count: number; policy: ClientRetentionPolicy }>(
    `/clients/${clientId}/compliance/retention/preview`,
  );
}

export async function runClientRetentionCleanup(clientId: string): Promise<{
  cutoff: string;
  count: number;
  client: ClientProfile;
}> {
  return apiFetch<{ cutoff: string; count: number; client: ClientProfile }>(
    `/clients/${clientId}/compliance/retention/run`,
    { method: 'POST' },
  );
}

export async function getClientConversionChecklist(
  clientId: string,
): Promise<import('@/types/domain').ConversionChecklistItem[]> {
  const data = await apiFetch<{ items: import('@/types/domain').ConversionChecklistItem[] }>(
    `/clients/${clientId}/conversion-checklist`,
  );
  return data.items;
}

export async function signupClient(input: {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}): Promise<ClientProfile> {
  const response = await fetch('/api/client-auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Signup failed: ${response.status}`);
  }

  const data = (await response.json()) as { client: ClientProfile };
  return data.client;
}

export async function updateClientOnboarding(
  clientId: string,
  input: {
    businessCategory?: string;
    pageId?: string;
    whatsappPoc?: string;
    onboardingStatus?: 'signup_started' | 'profile_complete' | 'channels_complete' | 'onboarding_complete';
    onboardingProfile?: ClientProfile['onboardingProfile'];
  },
): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/onboarding`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.client;
}

export async function getClientDashboard(clientId: string): Promise<ClientDashboardSummary> {
  return apiFetch<ClientDashboardSummary>(`/clients/${clientId}/dashboard`);
}

export async function disconnectWhatsApp(clientId: string): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>(`/clients/${clientId}/whatsapp/disconnect`, {
    method: 'POST',
  });
  return data.client;
}

export type MetaOAuthPageOption = {
  id: string;
  name: string;
};

export type MetaOAuthSession = {
  id: string;
  status: string;
  error?: string;
  pages: MetaOAuthPageOption[];
  selectedPageId?: string;
  expiresAt: string;
  completedAt?: string;
};

export async function startMetaOAuth(clientId: string, returnTo?: string): Promise<{ authorizationUrl: string; expiresAt: string }> {
  return apiFetch<{ authorizationUrl: string; expiresAt: string }>(`/clients/${clientId}/meta/oauth/start`, {
    method: 'POST',
    body: JSON.stringify({ returnTo }),
  });
}

export async function getMetaOAuthSession(clientId: string, sessionId: string): Promise<MetaOAuthSession> {
  const data = await apiFetch<{ session: MetaOAuthSession }>(`/clients/${clientId}/meta/oauth-sessions/${sessionId}`);
  return data.session;
}

export async function selectMetaOAuthPage(clientId: string, sessionId: string, pageId: string): Promise<{ page: MetaOAuthPageOption }> {
  const data = await apiFetch<{ connection: { page: MetaOAuthPageOption } }>(
    `/clients/${clientId}/meta/oauth-sessions/${sessionId}/select`,
    {
      method: 'POST',
      body: JSON.stringify({ pageId }),
    },
  );
  return data.connection;
}

export async function disconnectMetaPage(clientId: string): Promise<{ disconnected: true; pageId: string }> {
  const data = await apiFetch<{ connection: { disconnected: true; pageId: string } }>(`/clients/${clientId}/meta/disconnect`, {
    method: 'POST',
  });
  return data.connection;
}

export async function getClientTickets(clientId: string, status = 'all'): Promise<Ticket[]> {
  const data = await apiFetch<{ tickets: Ticket[] }>(`/clients/${clientId}/tickets?status=${status}`);
  return data.tickets;
}

export async function getClientTicketDetail(
  clientId: string,
  ticketId: string,
): Promise<TicketDetail & { conversation?: ConversationLog }> {
  return apiFetch<TicketDetail & { conversation?: ConversationLog }>(`/clients/${clientId}/tickets/${ticketId}`);
}

export async function updateClientTicketStatus(
  clientId: string,
  ticketId: string,
  status: TicketStatus,
  expectedVersion?: number,
): Promise<Ticket> {
  const data = await apiFetch<{ ticket: Ticket }>(`/clients/${clientId}/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, expectedVersion }),
  });
  return data.ticket;
}

export async function captureCsat(
  clientId: string,
  conversationId: string,
  input: { score: number; comment?: string },
): Promise<ConversationLog> {
  const data = await apiFetch<{ conversation: ConversationLog }>(`/clients/${clientId}/conversations/${conversationId}/csat`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.conversation;
}

export async function getExternalDataSources(clientId: string): Promise<ExternalDataSource[]> {
  const data = await apiFetch<{ sources: ExternalDataSource[] }>(`/clients/${clientId}/external-data/sources`);
  return data.sources;
}

export async function saveGoogleSheetDataSource(
  clientId: string,
  input: {
    name?: string;
    sheetUrl: string;
    productsTabName?: string;
    ordersTabName?: string;
    syncIntervalMinutes?: number;
    productFreshnessMinutes?: number;
    orderFreshnessMinutes?: number;
  },
): Promise<ExternalDataSource> {
  const data = await apiFetch<{ source: ExternalDataSource }>(`/clients/${clientId}/external-data/google-sheet`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.source;
}

export async function syncExternalDataSource(
  clientId: string,
  sourceId: string,
): Promise<{ source: ExternalDataSource; syncRun: ExternalDataSyncRun }> {
  return apiFetch<{ source: ExternalDataSource; syncRun: ExternalDataSyncRun }>(`/clients/${clientId}/external-data/sources/${sourceId}/sync`, {
    method: 'POST',
  });
}

export async function getExternalProducts(clientId: string, sourceId?: string): Promise<ProductRecord[]> {
  const query = sourceId === undefined ? '' : `?sourceId=${encodeURIComponent(sourceId)}`;
  const data = await apiFetch<{ products: ProductRecord[] }>(`/clients/${clientId}/external-data/products${query}`);
  return data.products;
}

export async function getExternalOrders(clientId: string, sourceId?: string): Promise<OrderRecord[]> {
  const query = sourceId === undefined ? '' : `?sourceId=${encodeURIComponent(sourceId)}`;
  const data = await apiFetch<{ orders: OrderRecord[] }>(`/clients/${clientId}/external-data/orders${query}`);
  return data.orders;
}

export async function getClientKnowledgeEntries(clientId: string): Promise<ClientKnowledgeEntry[]> {
  const data = await apiFetch<{ entries: ClientKnowledgeEntry[] }>(`/clients/${clientId}/knowledge/client-view`);
  return data.entries;
}

export async function getClientKnowledgeRequests(
  clientId: string,
  input: { status?: KnowledgeChangeRequestStatus | 'all'; urgency?: KnowledgeChangeRequestUrgency | 'all' } = {},
): Promise<KnowledgeChangeRequest[]> {
  const params = new URLSearchParams();
  if (input.status !== undefined) params.set('status', input.status);
  if (input.urgency !== undefined) params.set('urgency', input.urgency);
  const query = params.size === 0 ? '' : `?${params.toString()}`;
  const data = await apiFetch<{ requests: KnowledgeChangeRequest[] }>(`/clients/${clientId}/knowledge/requests${query}`);
  return data.requests;
}

export async function getClientKnowledgeRequest(clientId: string, requestId: string): Promise<KnowledgeChangeRequest> {
  const data = await apiFetch<{ request: KnowledgeChangeRequest }>(`/clients/${clientId}/knowledge/requests/${requestId}`);
  return data.request;
}

export async function submitClientKnowledgeRequest(
  clientId: string,
  input: {
    proposedTitle: string;
    proposedAnswer: string;
    proposedKeywords?: string[];
    proposedCategory?: string;
    urgency?: KnowledgeChangeRequestUrgency;
    requesterNote?: string;
  },
): Promise<KnowledgeChangeRequest> {
  const data = await apiFetch<{ request: KnowledgeChangeRequest }>(`/clients/${clientId}/knowledge/requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.request;
}

export async function submitClientKnowledgeEditRequest(
  clientId: string,
  entryId: string,
  input: {
    proposedTitle: string;
    proposedAnswer: string;
    proposedKeywords?: string[];
    proposedCategory?: string;
    urgency?: KnowledgeChangeRequestUrgency;
    requesterNote?: string;
  },
): Promise<KnowledgeChangeRequest> {
  const data = await apiFetch<{ request: KnowledgeChangeRequest }>(`/clients/${clientId}/knowledge/${entryId}/requests`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.request;
}

export async function getInternalKnowledgeRequests(input: {
  clientId?: string;
  status?: KnowledgeChangeRequestStatus | 'all';
  urgency?: KnowledgeChangeRequestUrgency | 'all';
} = {}): Promise<KnowledgeChangeRequest[]> {
  const params = new URLSearchParams();
  if (input.clientId !== undefined) params.set('clientId', input.clientId);
  if (input.status !== undefined) params.set('status', input.status);
  if (input.urgency !== undefined) params.set('urgency', input.urgency);
  const query = params.size === 0 ? '' : `?${params.toString()}`;
  const data = await apiFetch<{ requests: KnowledgeChangeRequest[] }>(`/internal/knowledge-requests${query}`);
  return data.requests;
}

export async function getInternalKnowledgeRequestDetail(requestId: string): Promise<KnowledgeChangeRequestReviewDetail> {
  return apiFetch<KnowledgeChangeRequestReviewDetail>(`/internal/knowledge-requests/${requestId}`);
}

export async function updateInternalKnowledgeRequest(
  requestId: string,
  action: 'in-review' | 'approve' | 'reject' | 'clarify',
  input: { reviewerNote?: string; clientVisibleMessage?: string; internalNote?: string; reviewedBy?: string },
): Promise<KnowledgeChangeRequest> {
  const data = await apiFetch<{ request: KnowledgeChangeRequest }>(`/internal/knowledge-requests/${requestId}/${action}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.request;
}

export async function editThenPublishKnowledgeRequest(
  requestId: string,
  input: {
    proposedTitle: string;
    proposedAnswer: string;
    proposedKeywords?: string[];
    proposedCategory?: string;
    reviewerNote?: string;
    clientVisibleMessage?: string;
    internalNote?: string;
    reviewedBy?: string;
  },
): Promise<KnowledgeChangeRequest> {
  const data = await apiFetch<{ request: KnowledgeChangeRequest }>(`/internal/knowledge-requests/${requestId}/edit-then-publish`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.request;
}

export async function getKnowledgeEntries(clientId: string, status = 'all'): Promise<KnowledgeEntry[]> {
  const data = await apiFetch<{ entries: KnowledgeEntry[] }>(`/clients/${clientId}/knowledge?status=${status}`);
  return data.entries;
}

export async function createKnowledgeDraft(
  clientId: string,
  input: { title: string; answer: string; keywords: string[]; category?: string; confidenceBoost?: number },
): Promise<KnowledgeEntry> {
  const data = await apiFetch<{ entry: KnowledgeEntry }>(`/clients/${clientId}/knowledge`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.entry;
}

export async function importKnowledgeFiles(
  clientId: string,
  input: { files: KnowledgeImportFileInput[]; actorId?: string },
): Promise<KnowledgeImportResult> {
  return apiFetch<KnowledgeImportResult>(`/clients/${clientId}/knowledge/import`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function importKnowledgeFromUrl(
  clientId: string,
  input: { url: string; actorId?: string },
): Promise<KnowledgeImportResult> {
  return apiFetch<KnowledgeImportResult>(`/clients/${clientId}/knowledge/import-url`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateKnowledgeEntry(
  clientId: string,
  entryId: string,
  input: { title?: string; answer?: string; keywords?: string[]; category?: string; confidenceBoost?: number; actorId?: string },
): Promise<KnowledgeEntry> {
  const data = await apiFetch<{ entry: KnowledgeEntry }>(`/clients/${clientId}/knowledge/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.entry;
}

export async function setKnowledgeStatus(
  clientId: string,
  entryId: string,
  status: KnowledgeEntry['status'],
): Promise<KnowledgeEntry> {
  const data = await apiFetch<{ entry: KnowledgeEntry }>(`/clients/${clientId}/knowledge/${entryId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actorId: 'internal-console' }),
  });
  return data.entry;
}

export async function getKnowledgeVersions(clientId: string, entryId: string): Promise<KnowledgeEntryVersion[]> {
  const data = await apiFetch<{ versions: KnowledgeEntryVersion[] }>(`/clients/${clientId}/knowledge/${entryId}/versions`);
  return data.versions;
}

export async function rollbackKnowledgeEntry(
  clientId: string,
  entryId: string,
  versionId: string,
): Promise<KnowledgeEntry> {
  const data = await apiFetch<{ entry: KnowledgeEntry }>(`/clients/${clientId}/knowledge/${entryId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId, actorId: 'internal-console' }),
  });
  return data.entry;
}

export async function markKnowledgeReviewed(
  clientId: string,
  entryId: string,
): Promise<KnowledgeEntry> {
  const data = await apiFetch<{ entry: KnowledgeEntry }>(
    `/clients/${clientId}/knowledge/${entryId}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ actorId: 'internal-console' }),
    },
  );
  return data.entry;
}

export async function getPromptProfiles(clientId: string, status = 'all'): Promise<PromptProfile[]> {
  const data = await apiFetch<{ profiles: PromptProfile[] }>(`/clients/${clientId}/prompts?status=${status}`);
  return data.profiles;
}

export async function createPromptProfile(
  clientId: string,
  input: Omit<PromptProfile, 'id' | 'clientId' | 'status' | 'version' | 'archivedAt' | 'createdAt' | 'updatedAt'> & {
    actorId?: string;
  },
): Promise<PromptProfile> {
  const data = await apiFetch<{ profile: PromptProfile }>(`/clients/${clientId}/prompts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.profile;
}

export async function updatePromptProfile(
  clientId: string,
  profileId: string,
  input: Partial<Omit<PromptProfile, 'id' | 'clientId' | 'status' | 'version' | 'archivedAt' | 'createdAt' | 'updatedAt'>> & {
    actorId?: string;
  },
): Promise<PromptProfile> {
  const data = await apiFetch<{ profile: PromptProfile }>(`/clients/${clientId}/prompts/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.profile;
}

export async function setPromptProfileStatus(
  clientId: string,
  profileId: string,
  status: PromptProfile['status'],
): Promise<PromptProfile> {
  const data = await apiFetch<{ profile: PromptProfile }>(`/clients/${clientId}/prompts/${profileId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actorId: 'internal-console' }),
  });
  return data.profile;
}

export async function getPromptProfileVersions(clientId: string, profileId: string): Promise<PromptProfileVersion[]> {
  const data = await apiFetch<{ versions: PromptProfileVersion[] }>(`/clients/${clientId}/prompts/${profileId}/versions`);
  return data.versions;
}

export async function rollbackPromptProfile(
  clientId: string,
  profileId: string,
  versionId: string,
): Promise<PromptProfile> {
  const data = await apiFetch<{ profile: PromptProfile }>(`/clients/${clientId}/prompts/${profileId}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ versionId, actorId: 'internal-console' }),
  });
  return data.profile;
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetail> {
  return apiFetch<TicketDetail>(`/tickets/${ticketId}`);
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus, expectedVersion?: number): Promise<Ticket> {
  const data = await apiFetch<{ ticket: Ticket }>(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actorId: 'internal-console', expectedVersion }),
  });
  return data.ticket;
}

export async function updateTicketAssignee(ticketId: string, assigneeId?: string, expectedVersion?: number): Promise<Ticket> {
  const data = await apiFetch<{ ticket: Ticket }>(`/tickets/${ticketId}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeId: assigneeId ?? null, actorId: 'internal-console', expectedVersion }),
  });
  return data.ticket;
}

export async function addTicketComment(ticketId: string, body: string): Promise<TicketComment> {
  const data = await apiFetch<{ comment: TicketComment }>(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, authorId: 'internal-console' }),
  });
  return data.comment;
}

export async function getTags(clientId: string): Promise<Tag[]> {
  const data = await apiFetch<{ tags: Tag[] }>(`/clients/${clientId}/tags`);
  return data.tags;
}

export async function createTag(clientId: string, name: string, color: TagColor): Promise<Tag> {
  const data = await apiFetch<{ tag: Tag }>(`/clients/${clientId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  });
  return data.tag;
}

export async function deleteTag(clientId: string, tagId: string): Promise<void> {
  await apiFetch(`/clients/${clientId}/tags/${tagId}`, { method: 'DELETE' });
}

export async function addTagToTicket(ticketId: string, tagId: string): Promise<Tag[]> {
  const data = await apiFetch<{ tags: Tag[] }>(`/tickets/${ticketId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagId }),
  });
  return data.tags;
}

export async function removeTagFromTicket(ticketId: string, tagId: string): Promise<Tag[]> {
  const data = await apiFetch<{ tags: Tag[] }>(`/tickets/${ticketId}/tags/${tagId}`, {
    method: 'DELETE',
  });
  return data.tags;
}

export async function bulkApplyTag(
  clientId: string,
  ticketIds: string[],
  tagId: string,
): Promise<{ applied: number }> {
  return apiFetch<{ applied: number }>(`/clients/${clientId}/tags/bulk-apply`, {
    method: 'POST',
    body: JSON.stringify({ ticketIds, tagId }),
  });
}

export async function searchConversations(query: string, limit = 30): Promise<ConversationSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const data = await apiFetch<{ results: ConversationSearchResult[] }>(
    `/conversations/search?${params.toString()}`,
  );
  return data.results;
}

export async function listBlockedSenders(clientId: string): Promise<BlockedSender[]> {
  const data = await apiFetch<{ blocks: BlockedSender[] }>(`/clients/${clientId}/blocked-senders`);
  return data.blocks;
}

export async function blockSender(
  clientId: string,
  input: { channel: 'messenger' | 'whatsapp' | 'web'; externalSenderId: string; reason?: string },
): Promise<BlockedSender> {
  const data = await apiFetch<{ block: BlockedSender }>(`/clients/${clientId}/blocked-senders`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.block;
}

export async function unblockSender(clientId: string, blockId: string): Promise<void> {
  await apiFetch(`/clients/${clientId}/blocked-senders/${blockId}`, { method: 'DELETE' });
}

export async function listTestCustomers(clientId: string): Promise<TestCustomer[]> {
  const data = await apiFetch<{ testCustomers: TestCustomer[] }>(
    `/clients/${clientId}/test-customers`,
  );
  return data.testCustomers;
}

export async function markTestCustomer(
  clientId: string,
  input: { channel: 'messenger' | 'whatsapp' | 'web'; externalSenderId: string; note?: string },
): Promise<TestCustomer> {
  const data = await apiFetch<{ testCustomer: TestCustomer }>(
    `/clients/${clientId}/test-customers`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  return data.testCustomer;
}

export async function unmarkTestCustomer(clientId: string, markId: string): Promise<void> {
  await apiFetch(`/clients/${clientId}/test-customers/${markId}`, { method: 'DELETE' });
}

export async function gradeConversation(
  conversationId: string,
  input: { qaGrade?: ConversationQaGrade; hallucinationFlag: boolean },
): Promise<ConversationLog> {
  const data = await apiFetch<{ conversation: ConversationLog }>(`/conversations/${conversationId}/grade`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, actorId: 'internal-console' }),
  });
  return data.conversation;
}

export async function takeOverConversation(conversationId: string): Promise<Ticket> {
  const data = await apiFetch<{ ticket: Ticket }>(`/conversations/${conversationId}/takeover`, {
    method: 'POST',
    body: JSON.stringify({ actorId: 'internal-console' }),
  });
  return data.ticket;
}

export async function updateConversationMessageTranscript(
  conversationId: string,
  messageId: string,
  transcript: string,
): Promise<ConversationLog['messages'][number]> {
  const data = await apiFetch<{ message: ConversationLog['messages'][number] }>(
    `/conversations/${conversationId}/messages/${messageId}/transcript`,
    {
      method: 'PATCH',
      body: JSON.stringify({ transcript }),
    },
  );
  return data.message;
}

// --- Voice: anchor console + onboarding (T10/T12) --------------------------------------------
export interface VoiceEscalation {
  id: string;
  clientId: string;
  threadId: string | null;
  callId: string | null;
  reason: string;
  mode: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
}

export async function getVoiceQueue(clientId: string): Promise<VoiceEscalation[]> {
  return (await apiFetch<{ queue: VoiceEscalation[] }>(`/console/${clientId}/queue`)).queue;
}

export async function getVoiceApprovals(clientId: string): Promise<unknown[]> {
  return (await apiFetch<{ approvals: unknown[] }>(`/console/${clientId}/approvals`)).approvals;
}

export async function decideVoiceApproval(clientId: string, actionId: string, decision: 'approve' | 'reject'): Promise<unknown> {
  return (await apiFetch<{ outcome: unknown }>(`/console/${clientId}/approvals/${actionId}`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })).outcome;
}

export async function takeVoiceEscalation(clientId: string, escalationId: string): Promise<VoiceEscalation> {
  return (await apiFetch<{ escalation: VoiceEscalation }>(`/console/${clientId}/escalations/${escalationId}/take`, { method: 'POST' })).escalation;
}

export async function resolveVoiceEscalation(clientId: string, escalationId: string): Promise<VoiceEscalation> {
  return (await apiFetch<{ escalation: VoiceEscalation }>(`/console/${clientId}/escalations/${escalationId}/resolve`, { method: 'POST' })).escalation;
}

export async function getVoiceCallDetail(clientId: string, callId: string): Promise<unknown> {
  return (await apiFetch<{ detail: unknown }>(`/console/${clientId}/calls/${callId}`)).detail;
}

export async function getFlaggedVoiceCalls(clientId: string): Promise<unknown[]> {
  return (await apiFetch<{ flagged: unknown[] }>(`/console/${clientId}/flagged`)).flagged;
}

export interface VoiceConfig {
  languagePosture?: string;
  greeting?: string;
  ttsVoice?: string;
  recordingConsent?: boolean;
}

export async function getVoiceOnboardingConfig(clientId: string): Promise<VoiceConfig | null> {
  return (await apiFetch<{ voiceConfig: VoiceConfig | null }>(`/onboarding/${clientId}/voice-config`)).voiceConfig;
}

export async function setVoiceOnboardingConfig(clientId: string, config: VoiceConfig): Promise<void> {
  await apiFetch(`/onboarding/${clientId}/voice-config`, { method: 'PUT', body: JSON.stringify(config) });
}

export async function registerVoiceNumber(clientId: string, e164Number: string, label?: string): Promise<unknown> {
  return (await apiFetch<{ number: unknown }>(`/onboarding/${clientId}/numbers`, {
    method: 'POST',
    body: JSON.stringify({ e164Number, label }),
  })).number;
}

export interface VoiceReadiness {
  numberReady: boolean;
  kbReady: boolean;
  voiceReady: boolean;
  ready: boolean;
}

export async function getVoiceReadiness(clientId: string): Promise<VoiceReadiness> {
  return (await apiFetch<{ readiness: VoiceReadiness }>(`/onboarding/${clientId}/readiness`)).readiness;
}
