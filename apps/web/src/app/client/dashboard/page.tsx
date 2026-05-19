'use client';

import { BookOpenText, CheckCircle2, Code2, Copy, MessageCircle, MessageSquareText, RefreshCw, TicketCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { captureCsat, getClientDashboard } from '@/lib/api';
import { ClientChannelSummary, ClientDashboardSummary } from '@/types/domain';

const channelIcons = {
  messenger: MessageSquareText,
  whatsapp: MessageCircle,
  web: Code2,
};

function formatChannelStatus(status: ClientChannelSummary['status']) {
  if (status === 'connected') return 'Connected';
  if (status === 'available') return 'Available';
  return 'Needs setup';
}

export default function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<ClientDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return 'pilot-client';
    return new URLSearchParams(window.location.search).get('clientId') ?? 'pilot-client';
  }, []);

  const channels = dashboard?.channels ?? [];
  const connectedChannelCount = channels.filter((channel) => channel.status !== 'needs_setup').length;

  async function loadDashboard() {
    setIsLoading(true);
    setError(null);
    try {
      setDashboard(await getClientDashboard(clientId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadDashboard();
  }, []);

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
        <div>
          <p className="eyebrow">Client dashboard</p>
          <h1>{dashboard?.client.businessName ?? 'AI Front Desk'}</h1>
        </div>
        <div className="panel-actions">
          <button className="icon-button" disabled={isLoading} type="button" onClick={() => void loadDashboard()}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <a className="icon-button" href={`/client/knowledge?clientId=${clientId}`}>
            <BookOpenText size={16} />
            Knowledge
          </a>
          <button className="icon-button" type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </header>

      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="client-command-card">
        <div className="client-command-main">
          <p className="eyebrow">Support coverage</p>
          <h2>AI assistance is active across {connectedChannelCount} of 3 customer channels</h2>
          <p>
            Messenger, WhatsApp, and the web widget are tracked separately so your team can see which channels are live,
            which need setup, and where customers are already talking.
          </p>
        </div>
        <div className="client-account-card">
          <span>Client account</span>
          <strong>{dashboard?.client.businessName ?? 'Loading account'}</strong>
          <small>{dashboard?.client.ownerEmail ?? dashboard?.client.ownerPhone ?? dashboard?.client.pageId ?? 'Contact details pending'}</small>
        </div>
      </section>

      <section className="metrics">
        <article className="metric">
          <span>Conversations</span>
          <strong>{dashboard?.totals.conversations ?? 0}</strong>
          <small>Handled by AI</small>
        </article>
        <article className="metric">
          <span>Containment</span>
          <strong>{dashboard?.totals.containmentRate ?? 0}%</strong>
          <small>No handoff needed</small>
        </article>
        <article className="metric">
          <span>Open Tickets</span>
          <strong>{dashboard?.totals.openTickets ?? 0}</strong>
          <small>P1: {dashboard?.totals.p1Tickets ?? 0}</small>
        </article>
        <article className="metric">
          <span>Sales Protected</span>
          <strong>{dashboard?.totals.salesRecoveredEstimate ?? 0}</strong>
          <small>BDT estimate</small>
        </article>
      </section>

      <section className="client-channel-grid" aria-label="Channel visibility">
        {channels.map((channel) => {
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
                  {channel.status === 'needs_setup' ? <TriangleAlert size={13} /> : <CheckCircle2 size={13} />}
                  {formatChannelStatus(channel.status)}
                </span>
              </div>
              <div className="channel-count">
                <strong>{channel.conversations}</strong>
                <span>conversations</span>
              </div>
              <p>{channel.detail}</p>
              <div className="channel-action-row">
                {channel.actionHref !== undefined ? (
                  <>
                    <a className="mini-button" href={channel.actionHref} target="_blank" rel="noreferrer">
                      Open widget
                    </a>
                    <button className="mini-button" type="button" onClick={() => void copyWidgetUrl(channel.actionHref ?? '')}>
                      <Copy size={13} />
                      Copy
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
              Recent tickets
            </div>
            <a className="mini-button" href={`/client/tickets?clientId=${clientId}`}>
              Delegate
            </a>
          </div>
          <div className="client-list">
            {(dashboard?.recentTickets ?? []).map((ticket) => (
              <article className="client-row" key={ticket.id}>
                <div>
                  <strong>{ticket.customerMessage}</strong>
                  <small>{ticket.status} | {ticket.priority} | BDT {ticket.salesRecoveredEstimate}</small>
                </div>
              </article>
            ))}
            {dashboard !== null && dashboard.recentTickets.length === 0 && <div className="empty">No tickets yet</div>}
          </div>
        </section>

        <section className="client-panel">
          <div className="panel-header">
            <div className="panel-title">
              <MessageSquareText size={16} />
              Recent conversations
            </div>
          </div>
          <div className="client-list">
            {(dashboard?.recentConversations ?? []).map((conversation) => {
              const last = conversation.messages.at(-1);
              return (
                <article className="client-row" key={conversation.id}>
                  <div>
                    <strong>{conversation.externalSenderId}</strong>
                    <small>{last?.text ?? 'No messages'}</small>
                  </div>
                  <div className="csat-buttons">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button className="mini-button" key={score} type="button" onClick={() => void handleCsat(conversation.id, score)}>
                        {score}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
