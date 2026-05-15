import { InternalUser, Ticket, TicketStatus } from '@/types/domain';

export const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  waiting_client: 'Waiting',
  resolved: 'Resolved',
};

export const statuses: TicketStatus[] = ['open', 'assigned', 'waiting_client', 'resolved'];

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
  return 'coral';
}

export function assigneeLabel(users: InternalUser[], assigneeId?: string) {
  return users.find((option) => option.id === assigneeId)?.label ?? 'Unassigned';
}

export function eventTitle(eventType: string) {
  if (eventType === 'ticket.created') return 'Ticket created';
  if (eventType === 'ticket.status_updated') return 'Status updated';
  if (eventType === 'ticket.assignee_updated') return 'Assignee updated';
  if (eventType === 'ticket.comment_added') return 'Comment added';
  return eventType;
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
