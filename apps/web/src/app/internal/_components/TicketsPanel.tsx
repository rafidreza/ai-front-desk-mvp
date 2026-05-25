import { RefreshCw, TicketCheck } from 'lucide-react';
import { InternalUser, Ticket } from '@/types/domain';
import { assigneeLabel, priorityTone, statusLabels, statusTone } from '../_lib/helpers';
import { EmptyState } from './EmptyState';
import { ListSkeleton } from './ListSkeleton';
import { PanelError } from './PanelError';
import { SlaBadge } from './SlaBadge';
import { TagChip } from './TagChip';

interface TicketsPanelProps {
  tickets: Ticket[];
  assigneeOptions: InternalUser[];
  assigneeFilter: string;
  activeTicketId?: string;
  isTicketsLoading: boolean;
  ticketsError: string | null;
  selectedIds?: Set<string>;
  onChangeFilter: (value: string) => void;
  onReload: () => void;
  onSelectTicket: (ticket: Ticket) => void;
  onToggleSelect?: (ticketId: string, selected: boolean) => void;
  onToggleSelectAll?: (selected: boolean) => void;
}

export function TicketsPanel({
  tickets,
  assigneeOptions,
  assigneeFilter,
  activeTicketId,
  isTicketsLoading,
  ticketsError,
  selectedIds,
  onChangeFilter,
  onReload,
  onSelectTicket,
  onToggleSelect,
  onToggleSelectAll,
}: TicketsPanelProps) {
  const selectionEnabled = selectedIds !== undefined && onToggleSelect !== undefined;
  const allSelected = selectionEnabled && tickets.length > 0 && tickets.every((ticket) => selectedIds.has(ticket.id));
  const someSelected = selectionEnabled && !allSelected && tickets.some((ticket) => selectedIds.has(ticket.id));

  return (
    <aside className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <TicketCheck size={16} />
          Tickets
        </div>
        <div className="panel-actions">
          {selectionEnabled && tickets.length > 0 && onToggleSelectAll !== undefined && (
            <label className="ticket-select-all" title={allSelected ? 'Clear all' : 'Select all'}>
              <input
                aria-label="Select all visible tickets"
                checked={allSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
                ref={(input) => {
                  if (input !== null) input.indeterminate = someSelected;
                }}
                type="checkbox"
              />
            </label>
          )}
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
            {isTicketsLoading && tickets.length === 0 && <ListSkeleton rows={5} variant="ticket" />}
            {!isTicketsLoading && tickets.length === 0 && (
              <EmptyState
                icon={<TicketCheck size={20} />}
                title="No tickets yet"
                description="Customer handoffs will appear here when conversations need human help."
                action={<a className="mini-button" href="/internal/conversations">Check conversations</a>}
              />
            )}
            {tickets.map((ticket) => {
              const isSelected = selectedIds?.has(ticket.id) ?? false;
              return (
                <div
                  className="ticket-row"
                  data-selected={ticket.id === activeTicketId}
                  data-checked={isSelected ? 'true' : undefined}
                  key={ticket.id}
                >
                  {selectionEnabled && (
                    <label className="ticket-row__checkbox" onClick={(event) => event.stopPropagation()}>
                      <input
                        aria-label={`Select ticket ${ticket.id}`}
                        checked={isSelected}
                        onChange={(event) => onToggleSelect(ticket.id, event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  )}
                  <button
                    className="ticket-row__main"
                    onClick={() => onSelectTicket(ticket)}
                    type="button"
                  >
                    <span className="priority-dot" data-priority={ticket.priority} />
                    <span className="ticket-main">
                      <span className="ticket-main__headline">
                        <strong>{ticket.customerMessage}</strong>
                        <span className="ticket-meta" aria-label="Ticket priority and status">
                          <span className="badge" data-tone={priorityTone(ticket.priority)}>
                            {ticket.priority}
                          </span>
                          <span className="badge" data-tone={statusTone(ticket.status)}>
                            {statusLabels[ticket.status]}
                          </span>
                        </span>
                      </span>
                      <small>{assigneeLabel(assigneeOptions, ticket.assigneeId)}</small>
                      <span className="ticket-row__metadata" aria-label="Ticket SLA and escalation context">
                        <SlaBadge ticket={ticket} />
                      </span>
                      {ticket.tags !== undefined && ticket.tags.length > 0 && (
                        <span className="ticket-tags">
                          {ticket.tags.map((tag) => (
                            <TagChip key={tag.id} tag={tag} />
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}
