'use client';

import { Activity, AlertTriangle, CheckCircle2, Clock3, Filter, History, MessageSquareText, RefreshCw, Send, TicketCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import { getClientTicketDetail, getClientTickets, updateClientTicketStatus } from '@/lib/api';
import { ConversationLog, Ticket, TicketDetail, TicketStatus } from '@/types/domain';

const statuses: TicketStatus[] = ['assigned', 'waiting_client', 'resolved'];
const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  waiting_client: 'Waiting on you',
  resolved: 'Resolved',
};

type ClientTicketDetail = TicketDetail & { conversation?: ConversationLog };

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function eventTitle(eventType: string) {
  if (eventType === 'ticket.created') return 'Ticket raised';
  if (eventType === 'ticket.status_updated') return 'Status updated';
  if (eventType === 'ticket.assignee_updated') return 'Owner updated';
  if (eventType === 'ticket.comment_added') return 'Operations note added';
  return eventType.replaceAll('.', ' ');
}

function priorityTone(priority: Ticket['priority']) {
  if (priority === 'P1') return 'coral';
  if (priority === 'P2') return 'amber';
  return 'blue';
}

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<ClientTicketDetail | null>(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  async function loadTickets(nextFilter = filter) {
    setIsLoading(true);
    setError(null);
    try {
      const nextTickets = await getClientTickets(clientId, nextFilter);
      setTickets(nextTickets);
      setSelectedTicketId((current) => {
        if (current !== null && nextTickets.some((ticket) => ticket.id === current)) return current;
        return nextTickets[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load tickets.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  async function loadTicketDetail(ticketId: string) {
    setIsDetailLoading(true);
    setDetailError(null);
    try {
      setTicketDetail(await getClientTicketDetail(clientId, ticketId));
    } catch (loadError) {
      setTicketDetail(null);
      setDetailError(loadError instanceof Error ? loadError.message : 'Unable to load ticket details.');
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    if (selectedTicketId === null) {
      setTicketDetail(null);
      setDetailError(null);
      return;
    }
    void loadTicketDetail(selectedTicketId);
  }, [selectedTicketId]);

  async function delegate(ticket: Ticket, status: TicketStatus) {
    setIsUpdating(true);
    setDetailError(null);
    try {
      await updateClientTicketStatus(clientId, ticket.id, status, ticket.version);
      await loadTickets();
      await loadTicketDetail(ticket.id);
    } catch (updateError) {
      setDetailError(updateError instanceof Error ? updateError.message : 'Unable to update ticket status.');
    } finally {
      setIsUpdating(false);
    }
  }

  async function logout() {
    await fetch('/api/client-auth/logout', { method: 'POST' });
    window.location.href = '/client/login';
  }

  const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved').length;
  const urgentTickets = tickets.filter((ticket) => ticket.priority === 'P1').length;
  const selectedTicket = ticketDetail?.ticket ?? tickets.find((ticket) => ticket.id === selectedTicketId);
  const visibleTimelineEvents = (ticketDetail?.events ?? []).filter((event) =>
    event.eventType === 'ticket.created' || event.eventType === 'ticket.status_updated',
  );

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark">TK</span>
          <div>
            <p className="eyebrow">Client delegation</p>
            <h1>Tickets</h1>
          </div>
        </div>
        <ClientPortalNav active="tickets" clientId={clientId} />
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadTickets()}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="client-ticket-command">
        <div>
          <p className="eyebrow">Ticket queue</p>
          <h2>Customer issues waiting for client decision</h2>
          <p>Review delegated conversations, update ownership state, and keep the support team aligned on resolution.</p>
        </div>
        <div className="ticket-command-stats">
          <div>
            <span>Open</span>
            <strong>{openTickets}</strong>
          </div>
          <div>
            <span>P1</span>
            <strong>{urgentTickets}</strong>
          </div>
        </div>
      </section>

      <div className="client-filter-bar">
        <div>
          <Filter size={15} />
          Status
        </div>
        <div className="filter-row">
          {['all', 'open', 'assigned', 'waiting_client', 'resolved'].map((item) => (
            <button
              className="status-button"
              data-active={filter === item}
              key={item}
              type="button"
              onClick={() => {
                setFilter(item);
                void loadTickets(item);
              }}
            >
              {item.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <section className="client-ticket-workspace">
        <section className="ticket-delegation-list" aria-label="Delegated tickets">
          {tickets.map((ticket) => (
            <article className="delegation-card" data-selected={selectedTicketId === ticket.id} key={ticket.id}>
              <button className="delegation-select" type="button" onClick={() => setSelectedTicketId(ticket.id)}>
                <div className="ticket-card-meta">
                  <span className="badge" data-tone={priorityTone(ticket.priority)}>
                    {ticket.priority}
                  </span>
                  <span>
                    <TicketCheck size={13} />
                    {statusLabels[ticket.status]}
                  </span>
                </div>
                <h2>{ticket.customerMessage}</h2>
                <p>{ticket.reason}</p>
                <small>BDT {ticket.salesRecoveredEstimate.toLocaleString('en')} protected estimate</small>
              </button>
              <div className="delegation-actions">
                {statuses.map((status) => (
                  <button
                    className="status-button"
                    data-active={ticket.status === status}
                    disabled={isUpdating}
                    key={status}
                    type="button"
                    onClick={() => void delegate(ticket, status)}
                  >
                    {status === 'resolved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {tickets.length === 0 && <div className="empty">No tickets</div>}
        </section>

        <section className="detail-panel client-ticket-detail">
          <div className="panel-header">
            <div className="panel-title">
              <Activity size={16} />
              Ticket detail
            </div>
            <div className="panel-actions">
              {isDetailLoading && <span className="badge">Loading</span>}
              {selectedTicketId !== null && (
                <button className="mini-button" disabled={isDetailLoading} type="button" onClick={() => void loadTicketDetail(selectedTicketId)} aria-label="Refresh ticket detail">
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>

          {selectedTicket === undefined ? (
            <div className="empty">Select a ticket to view details</div>
          ) : (
            <div className="case-layout client-case-layout">
              <section className="case-summary">
                <div className="case-heading">
                  <div>
                    <p className="eyebrow">Raised from customer conversation</p>
                    <h3>{selectedTicket.customerMessage}</h3>
                  </div>
                  <span className="badge" data-tone={priorityTone(selectedTicket.priority)}>
                    {selectedTicket.priority}
                  </span>
                </div>

                {detailError !== null && (
                  <div className="inline-alert">
                    <AlertTriangle size={14} />
                    {detailError}
                  </div>
                )}

                <div className="detail-grid">
                  <div className="field">
                    <span>Current state</span>
                    <strong>{statusLabels[selectedTicket.status]}</strong>
                  </div>
                  <div className="field">
                    <span>Raised</span>
                    <strong>{formatTime(selectedTicket.createdAt)}</strong>
                  </div>
                  <div className="field">
                    <span>Last updated</span>
                    <strong>{formatTime(selectedTicket.updatedAt)}</strong>
                  </div>
                  <div className="field">
                    <span>Protected sale</span>
                    <strong>BDT {selectedTicket.salesRecoveredEstimate.toLocaleString('en')}</strong>
                  </div>
                  <div className="field field-wide">
                    <span>Why this ticket was raised</span>
                    <strong>{selectedTicket.reason}</strong>
                  </div>
                </div>

                <div className="status-actions">
                  {statuses.map((status) => (
                    <button
                      className="status-button"
                      data-active={selectedTicket.status === status}
                      disabled={isUpdating}
                      key={status}
                      type="button"
                      onClick={() => void delegate(selectedTicket, status)}
                    >
                      {status === 'resolved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="reply-panel">
                <div className="section-label">
                  <Send size={15} />
                  Suggested reply
                </div>
                <p>{selectedTicket.suggestedReply}</p>
              </section>

              <section className="timeline-panel">
                <div className="section-label">
                  <History size={15} />
                  Ticket timeline
                </div>
                {isDetailLoading ? (
                  <div className="timeline-empty">Loading timeline</div>
                ) : (
                  <div className="timeline">
                    {visibleTimelineEvents.map((event) => (
                      <article className="timeline-item" key={event.id}>
                        <span className="timeline-dot" />
                        <div>
                          <strong>{eventTitle(event.eventType)}</strong>
                          <small>{formatTime(event.createdAt)}</small>
                          {'status' in event.payload && typeof event.payload.status === 'string' && (
                            <p>{statusLabels[event.payload.status as TicketStatus] ?? event.payload.status}</p>
                          )}
                          {'reason' in event.payload && typeof event.payload.reason === 'string' && (
                            <p>{event.payload.reason}</p>
                          )}
                        </div>
                      </article>
                    ))}
                    {visibleTimelineEvents.length === 0 && <div className="timeline-empty">No timeline events yet</div>}
                  </div>
                )}
              </section>

              <section className="thread client-ticket-thread">
                <div className="section-label">
                  <MessageSquareText size={15} />
                  Customer conversation
                </div>
                {(ticketDetail?.conversation?.messages ?? []).map((message) => (
                  <article className="bubble" data-direction={message.direction} key={message.id}>
                    <p>{message.text}</p>
                    <time>{formatTime(message.createdAt)}</time>
                  </article>
                ))}
                {(ticketDetail?.conversation?.messages ?? []).length === 0 && (
                  <div className="timeline-empty">Conversation transcript will appear here when loaded</div>
                )}
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
