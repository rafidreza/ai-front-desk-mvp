import {
  ApiHealth,
  CalibrationQueueFilter,
  CalibrationQueueResult,
  ClientDashboardSummary,
  ClientProfile,
  ConversationLog,
  ConversationQaGrade,
  InternalUser,
  KnowledgeEntry,
  KnowledgeEntryVersion,
  KnowledgeImportFileInput,
  KnowledgeImportResult,
  PromptProfile,
  PromptProfileVersion,
  Ticket,
  TicketComment,
  TicketDetail,
  TicketStatus,
} from '@/types/domain';

const apiBaseUrl = '/api/backend';

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
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getDatabaseHealth(): Promise<ApiHealth> {
  return apiFetch<ApiHealth>('/health/db');
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

export async function createInternalUser(input: {
  label: string;
  email?: string;
  role: string;
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

export async function signupClient(input: {
  businessName: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessCategory?: string;
  pageId?: string;
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

export async function getClientDashboard(clientId: string): Promise<ClientDashboardSummary> {
  return apiFetch<ClientDashboardSummary>(`/clients/${clientId}/dashboard`);
}

export async function getClientTickets(clientId: string, status = 'all'): Promise<Ticket[]> {
  const data = await apiFetch<{ tickets: Ticket[] }>(`/clients/${clientId}/tickets?status=${status}`);
  return data.tickets;
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
