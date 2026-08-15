'use client';

import { Activity, AlertTriangle, CheckCircle2, Clock3, Filter, History, MessageSquareText, RefreshCw, Send, TicketCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DaemionMark } from '../../_components/DaemionBrand';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import { getClientDashboard, getClientTicketDetail, getClientTickets, updateClientTicketStatus } from '@/lib/api';
import { getClientPortalCopy, priorityTone } from '@/lib/client-portal-copy';
import { formatBdt, formatLocalizedDateTime, formatLocalizedNumber } from '@/lib/localized-format';
import { ClientProfile, ConversationLog, Ticket, TicketDetail, TicketStatus } from '@/types/domain';

const statuses: TicketStatus[] = ['assigned', 'waiting_client', 'resolved'];
const filters: Array<'all' | 'open' | TicketStatus> = ['all', 'open', 'assigned', 'waiting_client', 'resolved'];

type ClientTicketDetail = TicketDetail & { conversation?: ConversationLog };

function formatTime(value: string, locale: string) {
  return formatLocalizedDateTime(value, locale === 'bn-BD' ? 'bangla' : 'english');
}

export default function ClientTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<ClientTicketDetail | null>(null);
  const [filter, setFilter] = useState('all');
  const [language, setLanguage] = useState<ClientProfile['defaultLanguage']>('english');
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);
  const copy = getClientPortalCopy(language);

  async function loadTickets(nextFilter = filter) {
    setIsLoading(true);
    setError(null);
    try {
      const [nextTickets, dashboard] = await Promise.all([getClientTickets(clientId, nextFilter), getClientDashboard(clientId)]);
      setLanguage(dashboard.client.defaultLanguage);
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
          <span className="client-mark"><DaemionMark /></span>
          <div>
            <p className="eyebrow">{copy.tickets.eyebrow}</p>
            <h1>{copy.tickets.title}</h1>
          </div>
        </div>
        <ClientPortalNav active="tickets" clientId={clientId} language={language} />
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadTickets()}>
            <RefreshCw size={16} />
            {copy.common.refresh}
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            {copy.common.signOut}
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="client-ticket-command">
        <div>
          <p className="eyebrow">{copy.tickets.queueEyebrow}</p>
          <h2>{copy.tickets.queueTitle}</h2>
          <p>{copy.tickets.queueDescription}</p>
        </div>
        <div className="ticket-command-stats">
          <div>
            <span>{copy.tickets.open}</span>
            <strong>{formatLocalizedNumber(openTickets, language)}</strong>
          </div>
          <div>
            <span>{copy.tickets.p1}</span>
            <strong>{formatLocalizedNumber(urgentTickets, language)}</strong>
          </div>
        </div>
      </section>

      <div className="client-filter-bar">
        <div>
          <Filter size={15} />
          {copy.tickets.status}
        </div>
        <div className="filter-row">
          {filters.map((item) => (
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
              {copy.filterLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <section className="client-ticket-workspace">
        <section className="ticket-delegation-list" aria-label={copy.tickets.delegatedTickets}>
          {tickets.map((ticket) => (
            <article className="delegation-card" data-selected={selectedTicketId === ticket.id} key={ticket.id}>
              <button className="delegation-select" type="button" onClick={() => setSelectedTicketId(ticket.id)}>
                <div className="ticket-card-meta">
                  <span className="badge" data-tone={priorityTone(ticket.priority)}>
                    {ticket.priority}
                  </span>
                  <span>
                    <TicketCheck size={13} />
                    {copy.statusLabels[ticket.status]}
                  </span>
                </div>
                <h2>{ticket.customerMessage}</h2>
                <p>{ticket.reason}</p>
                <small>{copy.tickets.protectedEstimate(ticket.salesRecoveredEstimate)}</small>
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
                    {copy.statusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {tickets.length === 0 && <div className="empty">{copy.tickets.noTickets}</div>}
        </section>

        <section className="detail-panel client-ticket-detail">
          <div className="panel-header">
            <div className="panel-title">
              <Activity size={16} />
              {copy.tickets.ticketDetail}
            </div>
            <div className="panel-actions">
              {isDetailLoading && <span className="badge">{copy.common.loading}</span>}
              {selectedTicketId !== null && (
                <button className="mini-button" disabled={isDetailLoading} type="button" onClick={() => void loadTicketDetail(selectedTicketId)} aria-label="Refresh ticket detail">
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>

          {selectedTicket === undefined ? (
            <div className="empty">{copy.tickets.selectTicket}</div>
          ) : (
            <div className="case-layout client-case-layout">
              <section className="case-summary">
                <div className="case-heading">
                  <div>
                    <p className="eyebrow">{copy.tickets.raisedFromConversation}</p>
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
                    <span>{copy.tickets.currentState}</span>
                    <strong>{copy.statusLabels[selectedTicket.status]}</strong>
                  </div>
                  <div className="field">
                    <span>{copy.tickets.raised}</span>
                    <strong>{formatTime(selectedTicket.createdAt, copy.locale)}</strong>
                  </div>
                  <div className="field">
                    <span>{copy.tickets.lastUpdated}</span>
                    <strong>{formatTime(selectedTicket.updatedAt, copy.locale)}</strong>
                  </div>
                  <div className="field">
                    <span>{copy.tickets.protectedSale}</span>
                    <strong>{formatBdt(selectedTicket.salesRecoveredEstimate, language)}</strong>
                  </div>
                  <div className="field field-wide">
                    <span>{copy.tickets.raisedReason}</span>
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
                      {copy.statusLabels[status]}
                    </button>
                  ))}
                </div>
              </section>

              <section className="reply-panel">
                <div className="section-label">
                  <Send size={15} />
                  {copy.tickets.suggestedReply}
                </div>
                <p>{selectedTicket.suggestedReply}</p>
              </section>

              <section className="timeline-panel">
                <div className="section-label">
                  <History size={15} />
                  {copy.tickets.timeline}
                </div>
                {isDetailLoading ? (
                  <div className="timeline-empty">{copy.tickets.loadingTimeline}</div>
                ) : (
                  <div className="timeline">
                    {visibleTimelineEvents.map((event) => (
                      <article className="timeline-item" key={event.id}>
                        <span className="timeline-dot" />
                        <div>
                          <strong>{copy.eventTitle(event.eventType)}</strong>
                          <small>{formatTime(event.createdAt, copy.locale)}</small>
                          {'status' in event.payload && typeof event.payload.status === 'string' && (
                            <p>{copy.statusLabels[event.payload.status as TicketStatus] ?? event.payload.status}</p>
                          )}
                          {'reason' in event.payload && typeof event.payload.reason === 'string' && (
                            <p>{event.payload.reason}</p>
                          )}
                        </div>
                      </article>
                    ))}
                    {visibleTimelineEvents.length === 0 && <div className="timeline-empty">{copy.tickets.noTimeline}</div>}
                  </div>
                )}
              </section>

              <section className="thread client-ticket-thread">
                <div className="section-label">
                  <MessageSquareText size={15} />
                  {copy.tickets.customerConversation}
                </div>
                {(ticketDetail?.conversation?.messages ?? []).map((message) => (
                  <article className="bubble" data-direction={message.direction} key={message.id}>
                    <p>{message.text}</p>
                    <time>{formatTime(message.createdAt, copy.locale)}</time>
                  </article>
                ))}
                {(ticketDetail?.conversation?.messages ?? []).length === 0 && (
                  <div className="timeline-empty">{copy.tickets.transcriptPending}</div>
                )}
              </section>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
