'use client';

import { CheckCircle2, Code2, Copy, MessageSquareText, RefreshCw, TicketCheck, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DaemionMark } from '../../_components/DaemionBrand';
import { ClientPortalNav } from '../_components/ClientPortalNav';
import { captureCsat, getClientDashboard } from '@/lib/api';
import { getClientPortalCopy } from '@/lib/client-portal-copy';
import { formatBdt, formatLocalizedDateTime, formatLocalizedNumber, formatLocalizedPercent } from '@/lib/localized-format';
import type { ClientDashboardSummary, ConversationLog } from '@/types/domain';

const channelIcons = {
  messenger: MessageSquareText,
  whatsapp: MessageSquareText,
  web: Code2,
};

function conversationLabel(conversation: ConversationLog) {
  if (conversation.channel === 'messenger' || conversation.channel === 'whatsapp') return 'Archived messaging';
  return 'Web chat';
}

export default function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<ClientDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-abc';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-abc';
  }, []);

  const channels = dashboard?.channels ?? [];
  const visibleChannels = channels.filter((channel) => channel.channel === 'web');
  const connectedChannelCount = visibleChannels.filter(
    (channel) => channel.status === 'connected' || channel.status === 'available',
  ).length;
  const language = dashboard?.client.defaultLanguage;
  const copy = getClientPortalCopy(language);
  const selectedConversation = dashboard?.recentConversations.find((conversation) => conversation.id === selectedConversationId);
  const selectedLastMessage = selectedConversation?.messages.at(-1);
  const selectedAiReplies = selectedConversation?.messages.filter((message) => message.direction === 'outbound').length ?? 0;
  const selectedCustomerMessages = selectedConversation?.messages.filter((message) => message.direction === 'inbound').length ?? 0;

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);
    try {
      setDashboard(await getClientDashboard(clientId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load your dashboard. Check your connection and tap Refresh. If it keeps failing, sign out and back in.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedConversationId === null) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelectedConversationId(null);
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedConversationId]);

  async function handleCsat(conversationId: string, score: number) {
    await captureCsat(clientId, conversationId, { score });
    await loadDashboard();
  }

  async function logout() {
    await fetch('/api/client-auth/logout', { method: 'POST' });
    window.location.href = '/client/login';
  }

  async function copyWidgetUrl(path: string) {
    if (navigator.clipboard === undefined) return;
    await navigator.clipboard.writeText(`${origin}${path}`);
  }

  return (
    <main className="client-shell">
      <header className="client-topbar">
        <div className="client-title-lockup">
          <span className="client-mark"><DaemionMark /></span>
          <div>
            <p className="eyebrow">{copy.dashboard.eyebrow}</p>
            <h1>{dashboard?.client.businessName ?? 'Daemion'}</h1>
          </div>
        </div>
        <ClientPortalNav active="dashboard" clientId={clientId} language={dashboard?.client.defaultLanguage} />
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadDashboard()}>
            <RefreshCw size={16} />
            {copy.common.refresh}
          </button>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            {copy.common.signOut}
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="client-command-card">
        <div className="client-command-main">
          <p className="eyebrow">{copy.dashboard.supportCoverage}</p>
          <h2>{copy.dashboard.coverageTitle(connectedChannelCount)}</h2>
          <p>{copy.dashboard.coverageDescription}</p>
        </div>
        <div className="client-account-card">
          <span>{copy.dashboard.clientAccount}</span>
          <strong>{dashboard?.client.businessName ?? copy.dashboard.loadingAccount}</strong>
          <small>{dashboard?.client.ownerEmail ?? dashboard?.client.ownerPhone ?? dashboard?.client.pageId ?? copy.dashboard.contactPending}</small>
          <div className="client-signal" data-online={connectedChannelCount > 0}>
            <span />
            {connectedChannelCount > 0 ? copy.dashboard.channelsOnline : copy.dashboard.setupNeeded}
          </div>
        </div>
      </section>

      <section className="metrics">
        <article className="metric">
          <span>{copy.dashboard.conversations}</span>
          <strong>{formatLocalizedNumber(dashboard?.totals.conversations ?? 0, language)}</strong>
          <small>{copy.dashboard.handledByAi}</small>
        </article>
        <article className="metric">
          <span>{copy.dashboard.containment}</span>
          <strong>{formatLocalizedPercent(dashboard?.totals.containmentRate ?? 0, language)}</strong>
          <small>{copy.dashboard.noHandoffNeeded}</small>
        </article>
        <article className="metric">
          <span>{copy.dashboard.openTickets}</span>
          <strong>{formatLocalizedNumber(dashboard?.totals.openTickets ?? 0, language)}</strong>
          <small>P1: {formatLocalizedNumber(dashboard?.totals.p1Tickets ?? 0, language)}</small>
        </article>
        <article className="metric">
          <span>{copy.dashboard.salesProtected}</span>
          <strong>{formatBdt(dashboard?.totals.salesRecoveredEstimate ?? 0, language)}</strong>
          <small>{copy.dashboard.bdtEstimate}</small>
        </article>
      </section>

      <section className="client-channel-grid" aria-label={copy.dashboard.channelVisibility}>
        {visibleChannels.map((channel) => {
          const ChannelIcon = channelIcons[channel.channel];
          return (
            <article className="channel-card" data-status={channel.status} key={channel.channel}>
              <div className="channel-card-head">
                <div className="channel-title">
                  <span>
                    <ChannelIcon size={18} />
                  </span>
                  <div>
                    <strong>{channel.label}</strong>
                    <small>{channel.setupLabel}</small>
                  </div>
                </div>
                <span className="status-pill" data-status={channel.status}>
                  {channel.status === 'connected' || channel.status === 'available' ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <TriangleAlert size={13} />
                  )}
                  {copy.channelStatus(channel.status)}
                </span>
              </div>
              <div className="channel-count">
                <strong>{formatLocalizedNumber(channel.conversations, language)}</strong>
                <span>{copy.dashboard.channelConversations}</span>
              </div>
              <p>{channel.detail}</p>
              <div className="channel-action-row">
                {channel.actionHref !== undefined ? (
                  <>
                    <a className="mini-button" href={channel.actionHref} target="_blank" rel="noreferrer">
                      {copy.dashboard.openWidget}
                    </a>
                    <button className="mini-button" type="button" onClick={() => void copyWidgetUrl(channel.actionHref ?? '')}>
                      <Copy size={13} />
                      {copy.common.copy}
                    </button>
                  </>
                ) : (
                  <span>{channel.actionLabel}</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="client-grid">
        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <TicketCheck size={16} />
              {copy.dashboard.recentTickets}
            </div>
            <a className="mini-button" href={`/client/tickets?clientId=${clientId}`}>
              {copy.dashboard.delegate}
            </a>
          </div>
          <div className="client-list">
            {(dashboard?.recentTickets ?? []).map((ticket) => (
              <article className="client-row" key={ticket.id}>
                <div>
                  <strong>{ticket.customerMessage}</strong>
                  <small>{ticket.status} | {ticket.priority} | {formatBdt(ticket.salesRecoveredEstimate, language)}</small>
                </div>
              </article>
            ))}
            {dashboard !== null && dashboard.recentTickets.length === 0 && <div className="empty">{copy.dashboard.noTicketsYet}</div>}
          </div>
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <MessageSquareText size={16} />
              {copy.dashboard.recentConversations}
            </div>
          </div>
          <div className="client-list">
            {(dashboard?.recentConversations ?? []).map((conversation) => {
              const last = conversation.messages.at(-1);
              return (
                <article className="client-row client-conversation-row" data-selected={selectedConversationId === conversation.id} key={conversation.id}>
                  <div>
                    <strong>{conversation.externalSenderId}</strong>
                    <small>{conversationLabel(conversation)} | {last?.text ?? copy.common.noMessages}</small>
                  </div>
                  <button className="mini-button" type="button" onClick={() => setSelectedConversationId(conversation.id)}>
                    View details
                  </button>
                </article>
              );
            })}
            {dashboard !== null && dashboard.recentConversations.length === 0 && <div className="empty">No conversations yet</div>}
          </div>
        </section>
      </section>

      {selectedConversation !== undefined && (
        <div className="conversation-comfort-overlay" role="presentation" onClick={() => setSelectedConversationId(null)}>
          <section
            aria-labelledby="conversation-comfort-title"
            aria-modal="true"
            className="conversation-comfort-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">Conversation handling</p>
                <h2 id="conversation-comfort-title">{selectedConversation.externalSenderId}</h2>
              </div>
              <div className="modal-header-actions">
                <span className="status-pill" data-status={selectedConversation.ticketId === undefined ? 'connected' : 'needs_setup'}>
                  {selectedConversation.ticketId === undefined ? 'Handled by AI' : 'Ticket opened'}
                </span>
                <button className="mini-button" type="button" onClick={() => setSelectedConversationId(null)} aria-label="Close conversation details">
                  <X size={15} />
                </button>
              </div>
            </header>

            <div className="conversation-comfort-body">
              <div className="conversation-assurance-grid">
                <div>
                  <span>Channel</span>
                  <strong>{conversationLabel(selectedConversation)}</strong>
                </div>
                <div>
                  <span>Customer messages</span>
                  <strong>{formatLocalizedNumber(selectedCustomerMessages, language)}</strong>
                </div>
                <div>
                  <span>AI replies</span>
                  <strong>{formatLocalizedNumber(selectedAiReplies, language)}</strong>
                </div>
                <div>
                  <span>AI confidence</span>
                  <strong>
                    {selectedConversation.lastConfidence === undefined
                      ? 'Not scored'
                      : formatLocalizedPercent(Math.round(selectedConversation.lastConfidence * 100), language)}
                  </strong>
                </div>
              </div>

              <div className="conversation-comfort-summary">
                <strong>{selectedLastMessage?.text ?? copy.common.noMessages}</strong>
                <small>
                  {selectedConversation.ticketId === undefined
                    ? 'Daemion answered this without needing your team to step in.'
                    : 'Daemion escalated this to your ticket queue because a business decision was needed.'}
                </small>
              </div>

              <div className="client-conversation-thread">
                {selectedConversation.messages.map((message) => (
                  <article className="client-conversation-bubble" data-direction={message.direction} key={message.id}>
                    <span>{message.direction === 'inbound' ? 'Customer' : 'Daemion AI'}</span>
                    <p>{message.text}</p>
                    {message.transcript !== undefined && message.transcript.trim() !== '' && <small>Transcript: {message.transcript}</small>}
                    <time>{formatLocalizedDateTime(message.createdAt, language)}</time>
                  </article>
                ))}
              </div>

              <div className="conversation-rating-row">
                <span>Rate this handling</span>
                <div className="csat-buttons">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button className="mini-button" key={score} type="button" onClick={() => void handleCsat(selectedConversation.id, score)}>
                      {formatLocalizedNumber(score, language)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
