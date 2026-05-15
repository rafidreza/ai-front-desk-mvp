import { RefreshCw, TicketCheck } from 'lucide-react';
import { InternalUser, Ticket } from '@/types/domain';
import { assigneeLabel, priorityTone, statusLabels, statusTone } from '../_lib/helpers';
import { PanelError } from './PanelError';

interface TicketsPanelProps {
  tickets: Ticket[];
  assigneeOptions: InternalUser[];
  assigneeFilter: string;
  activeTicketId?: string;
  isTicketsLoading: boolean;
  ticketsError: string | null;
  onChangeFilter: (value: string) => void;
  onReload: () => void;
  onSelectTicket: (ticket: Ticket) => void;
}

export function TicketsPanel({
  tickets,
  assigneeOptions,
  assigneeFilter,
  activeTicketId,
  isTicketsLoading,
  ticketsError,
  onChangeFilter,
  onReload,
  onSelectTicket,
}: TicketsPanelProps) {
  return (
    <aside className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <TicketCheck size={16} />
          Tickets
        </div>
        <div className="panel-actions">
          <select
            className="owner-filter"
            value={assigneeFilter}
            onChange={(event) => onChangeFilter(event.target.value)}
            aria-label="Filter by assignee"
          >
            <option value="all">All owners</option>
            <option value="unassigned">Unassigned</option>
            {assigneeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          {isTicketsLoading && <span className="badge">Loading</span>}
          <span className="count">{tickets.length}</span>
          <button
            className="mini-button"
            type="button"
            onClick={onReload}
            disabled={isTicketsLoading}
            aria-label="Retry tickets"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="ticket-list">
        {ticketsError !== null ? (
          <PanelError message={ticketsError} isRetrying={isTicketsLoading} onRetry={onReload} />
        ) : (
          <>
            {tickets.length === 0 && <div className="empty">No tickets</div>}
            {tickets.map((ticket) => (
              <button
                className="ticket-row"
                data-selected={ticket.id === activeTicketId}
                key={ticket.id}
                type="button"
                onClick={() => onSelectTicket(ticket)}
              >
                <span className="priority-dot" data-priority={ticket.priority} />
                <span className="ticket-main">
                  <strong>{ticket.customerMessage}</strong>
                  <small>
                    {assigneeLabel(assigneeOptions, ticket.assigneeId)} | {ticket.reason}
                  </small>
                </span>
                <span className="ticket-meta">
                  <span className="badge" data-tone={priorityTone(ticket.priority)}>
                    {ticket.priority}
                  </span>
                  <span className="badge" data-tone={statusTone(ticket.status)}>
                    {statusLabels[ticket.status]}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
