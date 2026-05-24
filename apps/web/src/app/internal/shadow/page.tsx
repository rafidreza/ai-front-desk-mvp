'use client';

import { ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getClients, getConversations, getTicketDetail } from '@/lib/api';
import {
  ClientProfile,
  ConversationLog,
  ConversationMessage,
  TicketComment,
} from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { UiSelect } from '../_components/UiSelect';
import { formatTime, getErrorMessage } from '../_lib/helpers';

interface ShadowPair {
  conversation: ConversationLog;
  client?: ClientProfile;
  lastInbound?: ConversationMessage;
  lastOutbound?: ConversationMessage;
  operatorComment?: TicketComment;
}

const ALL_CLIENTS_VALUE = '__all__';

export default function ShadowReviewPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [commentsByTicket, setCommentsByTicket] = useState<Record<string, TicketComment | null>>({});
  const [selectedClientId, setSelectedClientId] = useState<string>(ALL_CLIENTS_VALUE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadEverything() {
    setIsLoading(true);
    setError(null);
    try {
      const [clientData, conversationData] = await Promise.all([
        getClients(),
        getConversations(),
      ]);
      setClients(clientData);
      setConversations(conversationData);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Could not load shadow comparison data.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEverything();
  }, []);

  const shadowClients = useMemo(
    () => clients.filter((entry) => entry.lifecycleStage === 'shadow'),
    [clients],
  );

  const visibleClients = selectedClientId === ALL_CLIENTS_VALUE ? shadowClients : shadowClients.filter((entry) => entry.id === selectedClientId);
  const visibleClientIds = new Set(visibleClients.map((client) => client.id));

  const pairs: ShadowPair[] = useMemo(() => {
    const filtered = conversations
      .filter((conversation) => visibleClientIds.has(conversation.clientId))
      .slice()
      .sort((a, b) => {
        const aLast = a.messages[a.messages.length - 1]?.createdAt ?? '';
        const bLast = b.messages[b.messages.length - 1]?.createdAt ?? '';
        return bLast.localeCompare(aLast);
      });

    return filtered.map((conversation) => {
      const lastInbound = [...conversation.messages]
        .reverse()
        .find((message) => message.direction === 'inbound');
      const lastOutbound = [...conversation.messages]
        .reverse()
        .find((message) => message.direction === 'outbound');
      const client = clients.find((entry) => entry.id === conversation.clientId);
      const operatorComment =
        conversation.ticketId !== undefined && conversation.ticketId !== null
          ? commentsByTicket[conversation.ticketId] ?? undefined
          : undefined;
      return { conversation, client, lastInbound, lastOutbound, operatorComment: operatorComment ?? undefined };
    });
  }, [conversations, clients, commentsByTicket, visibleClientIds]);

  useEffect(() => {
    const needed = pairs
      .map((pair) => pair.conversation.ticketId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && commentsByTicket[id] === undefined);
    if (needed.length === 0) return;
    let cancelled = false;
    Promise.all(needed.map((ticketId) => getTicketDetail(ticketId).catch(() => null)))
      .then((details) => {
        if (cancelled) return;
        setCommentsByTicket((current) => {
          const next = { ...current };
          for (const detail of details) {
            if (detail === null) continue;
            const firstComment = detail.comments[0] ?? null;
            next[detail.ticket.id] = firstComment;
          }
          for (const ticketId of needed) {
            if (next[ticketId] === undefined) next[ticketId] = null;
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pairs, commentsByTicket]);

  return (
    <InternalShell
      activeView="qa"
      eyebrow="Shadow mode review"
      title="AI reply vs operator handoff before go-live"
      action={
        <div className="page-actions">
          <Link className="icon-button" href="/internal/pipeline">
            <ArrowLeft size={15} />
            Back to pipeline
          </Link>
          <button
            className="icon-button"
            disabled={isLoading}
            onClick={() => void loadEverything()}
            type="button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="shadow-filter">
        <label>
          Client filter
          <UiSelect
            onChange={(event) => setSelectedClientId(event.target.value)}
            value={selectedClientId}
          >
            <option value={ALL_CLIENTS_VALUE}>All shadow-stage clients ({shadowClients.length})</option>
            {shadowClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </UiSelect>
        </label>
        <p className="shadow-filter__help">
          Only clients whose lifecycle stage is <strong>shadow</strong> appear here. Move a client
          to shadow from the pipeline once their KB is ready for human-in-the-loop review.
        </p>
      </section>

      {shadowClients.length === 0 ? (
        <div className="shadow-empty">
          <MessageSquare size={20} />
          <strong>No clients in shadow mode.</strong>
          <span>
            Move a client to <em>shadow</em> on{' '}
            <Link href="/internal/pipeline">the pipeline</Link> to start reviewing AI replies side
            by side with operator notes.
          </span>
        </div>
      ) : (
        <section className="shadow-grid">
          {pairs.length === 0 && !isLoading && (
            <div className="empty">No recorded conversations for the selected client yet.</div>
          )}
          {pairs.map((pair) => (
            <article className="shadow-card" key={pair.conversation.id}>
              <header>
                <div>
                  <strong>{pair.client?.businessName ?? pair.conversation.clientId}</strong>
                  <small>
                    {pair.conversation.channel} · customer {pair.conversation.externalSenderId}
                  </small>
                </div>
                <span className="shadow-card__time">
                  {pair.lastInbound !== undefined
                    ? formatTime(pair.lastInbound.createdAt)
                    : pair.lastOutbound !== undefined
                      ? formatTime(pair.lastOutbound.createdAt)
                      : '—'}
                </span>
              </header>

              <div className="shadow-card__customer">
                <span>Customer asked</span>
                <p>{pair.lastInbound?.text ?? '—'}</p>
              </div>

              <div className="shadow-card__compare">
                <div className="shadow-card__col" data-source="ai">
                  <span>AI reply</span>
                  <p>{pair.lastOutbound?.text ?? '— no AI reply yet —'}</p>
                </div>
                <div className="shadow-card__col" data-source="operator">
                  <span>Operator note</span>
                  <p>
                    {pair.operatorComment?.body
                      ?? (pair.conversation.ticketId !== undefined
                        ? 'No operator note yet on the linked ticket.'
                        : 'No ticket created — AI was confident enough to handle this alone.')}
                  </p>
                </div>
              </div>

              {pair.conversation.ticketId !== undefined && (
                <footer>
                  <Link
                    className="mini-button"
                    href={`/internal/tickets?ticketId=${pair.conversation.ticketId}`}
                  >
                    Open ticket
                  </Link>
                </footer>
              )}
            </article>
          ))}
        </section>
      )}
    </InternalShell>
  );
}
