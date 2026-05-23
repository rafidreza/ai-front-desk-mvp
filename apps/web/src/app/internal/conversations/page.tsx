'use client';

import { Ban, Handshake, MessageSquareText, RefreshCw, Search, TicketCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  blockSender,
  getConversations,
  listBlockedSenders,
  searchConversations,
  takeOverConversation,
  unblockSender,
} from '@/lib/api';
import { BlockedSender, ConversationLog, ConversationSearchResult, Ticket } from '@/types/domain';
import { ConversationsPanel } from '../_components/ConversationsPanel';
import { InternalShell } from '../_components/InternalShell';
import { formatTime, getErrorMessage } from '../_lib/helpers';

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const [blocksByClient, setBlocksByClient] = useState<Record<string, BlockedSender[]>>({});
  const [isBlocking, setIsBlocking] = useState(false);

  async function loadConversations() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getConversations();
      setConversations(data);
      setSelectedConversationId((current) => current ?? data[0]?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Conversations could not load from the API. Fix: confirm the API server is running, then refresh.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    searchTimerRef.current = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);
      searchConversations(trimmed)
        .then((results) => setSearchResults(results))
        .catch((searchErrorValue) => {
          setSearchError(
            getErrorMessage(
              searchErrorValue,
              'Search could not run. Fix: try a shorter query or refresh the page.',
            ),
          );
          setSearchResults([]);
        })
        .finally(() => setIsSearching(false));
    }, 300);
    return () => {
      if (searchTimerRef.current !== null) window.clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
  }

  function openSearchResult(result: ConversationSearchResult) {
    setSelectedConversationId(result.conversationId);
    clearSearch();
    setNotice(null);
    setCreatedTicket(null);
  }

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) ??
      conversations[0],
    [conversations, selectedConversationId],
  );
  const linkedTicketId = createdTicket !== null && createdTicket.conversationId === selectedConversation?.id
    ? createdTicket.id
    : selectedConversation?.ticketId;

  useEffect(() => {
    if (selectedConversation === undefined) return;
    const cid = selectedConversation.clientId;
    if (blocksByClient[cid] !== undefined) return;
    let cancelled = false;
    void listBlockedSenders(cid)
      .then((blocks) => {
        if (!cancelled) setBlocksByClient((current) => ({ ...current, [cid]: blocks }));
      })
      .catch(() => {
        if (!cancelled) setBlocksByClient((current) => ({ ...current, [cid]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedConversation, blocksByClient]);

  const existingBlock = useMemo(() => {
    if (selectedConversation === undefined) return null;
    const list = blocksByClient[selectedConversation.clientId] ?? [];
    return (
      list.find(
        (block) =>
          block.channel === selectedConversation.channel &&
          block.externalSenderId === selectedConversation.externalSenderId,
      ) ?? null
    );
  }, [blocksByClient, selectedConversation]);

  async function handleBlock() {
    if (selectedConversation === undefined) return;
    setIsBlocking(true);
    setError(null);
    setNotice(null);
    try {
      const block = await blockSender(selectedConversation.clientId, {
        channel: selectedConversation.channel,
        externalSenderId: selectedConversation.externalSenderId,
        reason: 'Blocked from conversation view',
      });
      setBlocksByClient((current) => ({
        ...current,
        [selectedConversation.clientId]: [...(current[selectedConversation.clientId] ?? []), block],
      }));
      setNotice('Sender blocked. Future messages from this customer will be ignored.');
    } catch (blockError) {
      setError(getErrorMessage(blockError, 'Could not block this sender.'));
    } finally {
      setIsBlocking(false);
    }
  }

  async function handleUnblock() {
    if (selectedConversation === undefined || existingBlock === null) return;
    setIsBlocking(true);
    setError(null);
    setNotice(null);
    try {
      await unblockSender(selectedConversation.clientId, existingBlock.id);
      setBlocksByClient((current) => ({
        ...current,
        [selectedConversation.clientId]: (current[selectedConversation.clientId] ?? []).filter(
          (block) => block.id !== existingBlock.id,
        ),
      }));
      setNotice('Sender unblocked. Future messages will be processed again.');
    } catch (unblockError) {
      setError(getErrorMessage(unblockError, 'Could not unblock this sender.'));
    } finally {
      setIsBlocking(false);
    }
  }

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
      setError(getErrorMessage(takeoverError, 'Conversation takeover could not start. Fix: refresh the conversation and retry.'));
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

      <section className="conversation-search">
        <div className="conversation-search__input">
          <Search size={15} />
          <input
            aria-label="Search conversations"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search every message — try 'refund', 'bkash', 'delivery koto'…"
            type="search"
            value={searchQuery}
          />
          {searchQuery.length > 0 && (
            <button aria-label="Clear search" onClick={clearSearch} type="button">
              <X size={14} />
            </button>
          )}
          {isSearching && <span className="conversation-search__busy">Searching…</span>}
        </div>
        {searchError !== null && <div className="inline-alert">{searchError}</div>}
        {searchResults !== null && (
          <div className="conversation-search__results">
            {searchResults.length === 0 ? (
              <p>No messages match. Try fewer words.</p>
            ) : (
              <ul>
                {searchResults.map((result) => (
                  <li key={result.matchedMessageId}>
                    <button onClick={() => openSearchResult(result)} type="button">
                      <span className="conversation-search__meta">
                        <strong>{result.externalSenderId}</strong>
                        <span data-direction={result.matchedMessageDirection}>
                          {result.matchedMessageDirection === 'inbound' ? 'Customer' : 'AI'}
                        </span>
                        <span>{result.channel}</span>
                        <time>{formatTime(result.matchedMessageCreatedAt)}</time>
                      </span>
                      <span className="conversation-search__snippet">{result.matchedMessageText}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

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
            <div className="panel-actions">
              {existingBlock !== null ? (
                <button
                  className="icon-button"
                  data-tone="coral"
                  disabled={isBlocking}
                  onClick={() => void handleUnblock()}
                  type="button"
                >
                  <Ban size={16} />
                  Unblock sender
                </button>
              ) : (
                <button
                  className="icon-button"
                  disabled={isBlocking || selectedConversation === undefined}
                  onClick={() => void handleBlock()}
                  type="button"
                >
                  <Ban size={16} />
                  Block sender
                </button>
              )}
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
          </div>

          {selectedConversation === undefined ? (
            <div className="empty">No conversation selected</div>
          ) : (
            <div className="conversation-detail">
              <section className="conversation-summary-strip">
                <div>
                  <span>Customer</span>
                  <strong>
                    {selectedConversation.externalSenderId}
                    {existingBlock !== null && (
                      <span className="block-badge" title={existingBlock.reason ?? 'Blocked'}>
                        <Ban size={11} />
                        Blocked
                      </span>
                    )}
                  </strong>
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
