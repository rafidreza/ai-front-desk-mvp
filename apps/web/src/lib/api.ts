import {
  ApiHealth,
  ClientDashboardSummary,
  ClientProfile,
  ConversationLog,
  ConversationQaGrade,
  InternalUser,
  KnowledgeEntry,
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

export async function getTickets(): Promise<Ticket[]> {
  const data = await apiFetch<{ tickets: Ticket[] }>('/tickets');
  return data.tickets;
}

export async function getInternalUsers(): Promise<InternalUser[]> {
  const data = await apiFetch<{ users: InternalUser[] }>('/internal/users');
  return data.users;
}

export async function signupClient(input: {
  businessName: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  businessCategory?: string;
  pageId?: string;
}): Promise<ClientProfile> {
  const data = await apiFetch<{ client: ClientProfile }>('/clients/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.client;
}

export async function getClientDashboard(clientId: string): Promise<ClientDashboardSummary> {
  return apiFetch<ClientDashboardSummary>(`/clients/${clientId}/dashboard`);
}

export async function getClientTickets(clientId: string, status = 'all'): Promise<Ticket[]> {
  const data = await apiFetch<{ tickets: Ticket[] }>(`/clients/${clientId}/tickets?status=${status}`);
  return data.tickets;
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
  input: { title: string; answer: string; keywords: string[]; confidenceBoost?: number },
): Promise<KnowledgeEntry> {
  const data = await apiFetch<{ entry: KnowledgeEntry }>(`/clients/${clientId}/knowledge`, {
    method: 'POST',
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
    body: JSON.stringify({ status }),
  });
  return data.entry;
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
