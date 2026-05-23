import { Ticket, TicketPriority, TicketStatus } from '@/types/domain';

// SLA windows by priority — minutes from ticket creation until a reply is
// expected. Per-client overrides land in T91 (channel health dashboard).
export const SLA_WINDOWS_MIN: Record<TicketPriority, number> = {
  P1: 60,
  P2: 240,
  P3: 1440,
};

// Statuses where the SLA timer is still running. Resolved freezes the clock.
const ACTIVE_STATUSES: ReadonlySet<TicketStatus> = new Set([
  'open',
  'assigned',
  'waiting_client',
]);

export type SlaState = 'on_track' | 'due_soon' | 'overdue' | 'paused';

export interface SlaSummary {
  state: SlaState;
  waitedMinutes: number;
  windowMinutes: number;
  ratio: number; // waitedMinutes / windowMinutes
  label: string;
  qualifier?: string;
}

function formatWaited(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 1) return 'just now';
  if (safe < 60) return `${safe}m`;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours < 24) {
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}

export function computeSla(ticket: Ticket, now: Date = new Date()): SlaSummary {
  const createdAt = new Date(ticket.createdAt);
  const waitedMinutes = (now.getTime() - createdAt.getTime()) / 60000;
  const windowMinutes = SLA_WINDOWS_MIN[ticket.priority];
  const ratio = waitedMinutes / windowMinutes;
  const label = formatWaited(waitedMinutes);

  if (!ACTIVE_STATUSES.has(ticket.status)) {
    return {
      state: 'paused',
      waitedMinutes,
      windowMinutes,
      ratio,
      label,
    };
  }

  if (ratio >= 1) {
    const overdueBy = formatWaited(waitedMinutes - windowMinutes);
    return {
      state: 'overdue',
      waitedMinutes,
      windowMinutes,
      ratio,
      label,
      qualifier: `overdue by ${overdueBy}`,
    };
  }

  if (ratio >= 0.8) {
    return {
      state: 'due_soon',
      waitedMinutes,
      windowMinutes,
      ratio,
      label,
      qualifier: 'due soon',
    };
  }

  return {
    state: 'on_track',
    waitedMinutes,
    windowMinutes,
    ratio,
    label,
  };
}
