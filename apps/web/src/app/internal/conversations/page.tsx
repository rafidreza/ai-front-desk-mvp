'use client';

import { Handshake, MessageSquareText, RefreshCw, TicketCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getConversations, takeOverConversation } from '@/lib/api';
import { ConversationLog, Ticket } from '@/types/domain';
import { ConversationsPanel } from '../_components/ConversationsPanel';
import { InternalShell } from '../_components/InternalShell';
import { formatTime } from '../_lib/helpers';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadConversations() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getConversations();
      setConversations(data);
      setSelectedConversationId((current) => current ?? data[0]?.id ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load conversations.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) ??
      conversations[0],
    [conversations, selectedConversationId],
  );
  const linkedTicketId = createdTicket !== null && createdTicket.conversationId === selectedConversation?.id
    ? createdTicket.id
    : selectedConversation?.ticketId;

  async function handleTakeover() {
    if (selectedConversation === undefined) return;
    setIsTakingOver(true);
    setNotice(null);
    setError(null);
    try {
      const ticket = await takeOverConversation(selectedConversation.id);
      setCreatedTicket(ticket);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, ticketId: ticket.id }
            : conversation,
        ),
      );
      setNotice(`Takeover started. Ticket ${ticket.id.slice(0, 8)} is ready for the support team.`);
    } catch (takeoverError) {
      setError(takeoverError instanceof Error ? takeoverError.message : 'Unable to take over conversation.');
    } finally {
      setIsTakingOver(false);
    }
  }

  return (
    <InternalShell
      activeView="conversations"
      eyebrow="Conversation monitor"
      title="Customer conversations and AI responses"
      action={
        <button className="icon-button" type="button" onClick={() => void loadConversations()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
      {notice !== null && <div className="inline-success">{notice}</div>}
      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="conversation-portal-grid">
        <ConversationsPanel
          conversations={conversations}
          activeConversationId={selectedConversation?.id}
          isConversationsLoading={isLoading}
          conversationsError={error}
          onReload={() => void loadConversations()}
          onSelect={(conversation) => {
            setSelectedConversationId(conversation.id);
            setCreatedTicket(null);
            setNotice(null);
          }}
        />

        <section className="detail-panel conversation-detail-panel">
          <div className="panel-header">
            <div className="panel-title">
              <MessageSquareText size={16} />
              Conversation detail
            </div>
            {linkedTicketId === undefined ? (
              <button
                className="icon-button"
                type="button"
                disabled={isTakingOver || selectedConversation === undefined}
                onClick={() => void handleTakeover()}
              >
                <Handshake size={16} />
                Take over
              </button>
            ) : (
              <Link className="icon-button" href={`/internal/tickets?ticketId=${linkedTicketId}`}>
                <TicketCheck size={16} />
                Open ticket
              </Link>
            )}
          </div>

          {selectedConversation === undefined ? (
            <div className="empty">No conversation selected</div>
          ) : (
            <div className="conversation-detail">
              <section className="conversation-summary-strip">
                <div>
                  <span>Customer</span>
                  <strong>{selectedConversation.externalSenderId}</strong>
                </div>
                <div>
                  <span>Channel</span>
                  <strong>{selectedConversation.channel}</strong>
                </div>
                <div>
                  <span>AI confidence</span>
                  <strong>
                    {selectedConversation.lastConfidence === undefined
                      ? 'Not scored'
                      : `${Math.round(selectedConversation.lastConfidence * 100)}%`}
                  </strong>
                </div>
                <div>
                  <span>QA</span>
                  <strong>{selectedConversation.qaGrade ?? selectedConversation.autoQaGrade ?? 'Pending'}</strong>
                </div>
              </section>

              <section className="conversation-thread">
                {selectedConversation.messages.map((message) => (
                  <article className="bubble" data-direction={message.direction} key={message.id}>
                    <small>{message.direction === 'outbound' ? 'AI response' : 'Customer'}</small>
                    <p>{message.text}</p>
                    <time>{formatTime(message.createdAt)}</time>
                  </article>
                ))}
                {selectedConversation.messages.length === 0 && (
                  <div className="empty">No messages recorded yet</div>
                )}
              </section>
            </div>
          )}
        </section>
      </section>
    </InternalShell>
  );
}
