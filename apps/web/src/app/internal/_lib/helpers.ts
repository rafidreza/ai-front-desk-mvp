import { InternalUser, Ticket, TicketStatus } from '@/types/domain';

export const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  waiting_client: 'Waiting',
  resolved: 'Resolved',
  reopened: 'Reopened',
};

export const statuses: TicketStatus[] = [
  'open',
  'assigned',
  'waiting_client',
  'resolved',
  'reopened',
];

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function priorityTone(priority: Ticket['priority']) {
  if (priority === 'P1') return 'coral';
  if (priority === 'P2') return 'amber';
  return 'blue';
}

export function statusTone(status: TicketStatus) {
  if (status === 'resolved') return 'green';
  if (status === 'waiting_client') return 'amber';
  if (status === 'assigned') return 'blue';
  if (status === 'reopened') return 'amber';
  return 'coral';
}

export function assigneeLabel(users: InternalUser[], assigneeId?: string) {
  return users.find((option) => option.id === assigneeId)?.label ?? 'Unassigned';
}

export function operatorLabel(users: InternalUser[], authorId?: string) {
  if (authorId === undefined || authorId === '') return 'Operator';
  const match = users.find((option) => option.id === authorId);
  if (match !== undefined) return match.label;
  if (authorId === 'internal-console' || authorId === 'internal-operator') return 'Operator';
  if (authorId === 'inbound-message') return 'Customer reply';
  return authorId;
}

export function eventTitle(eventType: string) {
  if (eventType === 'ticket.created') return 'Ticket created';
  if (eventType === 'ticket.status_updated') return 'Status updated';
  if (eventType === 'ticket.assignee_updated') return 'Assignee updated';
  if (eventType === 'ticket.comment_added') return 'Comment added';
  if (eventType === 'ticket.reopened') return 'Reopened by customer reply';
  if (eventType === 'ticket.manual_takeover_requested') return 'Manual takeover';
  return eventType;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || error.message.trim().length === 0) return fallback;

  const detail = error.message.trim();
  if (/^(API request failed|Backend request failed|Signup failed)/i.test(detail)) {
    return fallback;
  }

  return `${fallback} Detail: ${detail}`;
}

export function getSafeErrorDiagnostic(error: unknown, context: string) {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return `Diagnostic: ${context} did not return a browser-visible error detail.`;
  }

  const detail = error.message.trim();
  const statusMatch = detail.match(/(?:API request failed|Backend request failed|Channel update failed):\s*(\d{3})/i);
  if (statusMatch !== null) {
    return `Diagnostic: ${context} returned HTTP ${statusMatch[1]}.`;
  }

  if (/failed to fetch|networkerror|load failed/i.test(detail)) {
    return `Diagnostic: ${context} could not reach the API from the browser.`;
  }

  return `Diagnostic: ${context} returned an unexpected client-side error.`;
}
