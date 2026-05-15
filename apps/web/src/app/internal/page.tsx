'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  addTicketComment,
  getConversations,
  getDatabaseHealth,
  getInternalUsers,
  getTicketDetail,
  getTickets,
  gradeConversation,
  updateTicketAssignee,
  updateTicketStatus,
} from '@/lib/api';
import {
  ApiHealth,
  ConversationLog,
  ConversationQaGrade,
  InternalUser,
  Ticket,
  TicketDetail,
  TicketStatus,
} from '@/types/domain';
import { ConversationsPanel } from './_components/ConversationsPanel';
import { MetricCards } from './_components/MetricCards';
import { QaReview } from './_components/QaReview';
import { Sidebar } from './_components/Sidebar';
import { TicketDetailPanel } from './_components/TicketDetailPanel';
import { TicketsPanel } from './_components/TicketsPanel';
import { assigneeLabel, getErrorMessage, statusLabels } from './_lib/helpers';

export default function InternalConsole() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<InternalUser[]>([]);
  const [activeView, setActiveView] = useState<'operations' | 'qa'>('operations');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [commentDraft, setCommentDraft] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(true);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [qaNotice, setQaNotice] = useState<string | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<TicketDetail | null>(null);

  async function loadHealthPanel() {
    setIsHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await getDatabaseHealth());
    } catch (loadError) {
      setHealthError(getErrorMessage(loadError, 'Unable to load database health.'));
    } finally {
      setIsHealthLoading(false);
    }
  }

  async function loadConversationsPanel() {
    setIsConversationsLoading(true);
    setConversationsError(null);
    try {
      const conversationData = await getConversations();
      setConversations(conversationData);
      setSelectedConversationId((current) => current ?? conversationData[0]?.id ?? null);
    } catch (loadError) {
      setConversationsError(getErrorMessage(loadError, 'Unable to load conversations.'));
    } finally {
      setIsConversationsLoading(false);
    }
  }

  async function loadTicketsPanel() {
    setIsTicketsLoading(true);
    setTicketsError(null);
    try {
      const ticketData = await getTickets();
      setTickets(ticketData);
      setSelectedTicketId((current) => current ?? ticketData[0]?.id ?? null);
    } catch (loadError) {
      setTicketsError(getErrorMessage(loadError, 'Unable to load tickets.'));
    } finally {
      setIsTicketsLoading(false);
    }
  }

  async function loadUsersPanel() {
    try {
      setAssigneeOptions(await getInternalUsers());
    } catch {
      setAssigneeOptions([]);
    }
  }

  async function loadData() {
    await Promise.all([loadHealthPanel(), loadConversationsPanel(), loadTicketsPanel(), loadUsersPanel()]);
  }

  async function loadTicketDetailPanel(ticketId: string) {
    setIsDetailLoading(true);
    setDetailError(null);
    setSelectedTicketDetail(null);
    try {
      setSelectedTicketDetail(await getTicketDetail(ticketId));
    } catch (detailLoadError) {
      setDetailError(getErrorMessage(detailLoadError, 'Unable to load ticket detail.'));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (selectedTicketId === null) {
      setSelectedTicketDetail(null);
      setDetailError(null);
      return;
    }

    let isActive = true;
    setIsDetailLoading(true);
    setDetailError(null);
    setSelectedTicketDetail(null);
    getTicketDetail(selectedTicketId)
      .then((detail) => {
        if (isActive) setSelectedTicketDetail(detail);
      })
      .catch((detailLoadError) => {
        if (isActive) {
          setDetailError(getErrorMessage(detailLoadError, 'Unable to load ticket detail.'));
        }
      })
      .finally(() => {
        if (isActive) setIsDetailLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [selectedTicketId]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0],
    [selectedTicketId, tickets],
  );
  const activeTicket = selectedTicketDetail?.ticket ?? selectedTicket;
  const filteredTickets = useMemo(() => {
    if (assigneeFilter === 'all') return tickets;
    if (assigneeFilter === 'unassigned') return tickets.filter((ticket) => ticket.assigneeId === undefined);
    return tickets.filter((ticket) => ticket.assigneeId === assigneeFilter);
  }, [assigneeFilter, tickets]);

  const selectedConversation = useMemo(() => {
    if (activeTicket !== undefined) {
      return conversations.find((conversation) => conversation.id === activeTicket.conversationId);
    }
    return (
      conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0]
    );
  }, [activeTicket, conversations, selectedConversationId]);

  const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved').length;
  const p1Tickets = tickets.filter((ticket) => ticket.priority === 'P1').length;
  const reviewConversations = conversations.slice(0, 100);
  const reviewedConversations = reviewConversations.filter(
    (conversation) => conversation.qaGrade !== undefined,
  );
  const containmentRate =
    reviewConversations.length === 0
      ? 0
      : Math.round(
          (reviewConversations.filter((conversation) => conversation.ticketId === undefined).length /
            reviewConversations.length) *
            100,
        );
  const hallucinationRate =
    reviewedConversations.length === 0
      ? 0
      : Math.round(
          (reviewedConversations.filter((conversation) => conversation.hallucinationFlag).length /
            reviewedConversations.length) *
            100,
        );
  const averageConfidence =
    conversations.length === 0
      ? 0
      : Math.round(
          (conversations.reduce(
            (sum, conversation) => sum + (conversation.lastConfidence ?? 0),
            0,
          ) /
            conversations.length) *
            100,
        );
  const isLoading = isHealthLoading || isTicketsLoading || isConversationsLoading;

  async function handleStatusChange(status: TicketStatus) {
    if (activeTicket === undefined) return;
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateNotice(null);
    try {
      const updated = await updateTicketStatus(activeTicket.id, status, activeTicket.version);
      const detail = await getTicketDetail(activeTicket.id);
      setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
      setSelectedTicketDetail(detail);
      setUpdateNotice(`Status updated to ${statusLabels[status]}.`);
    } catch (statusError) {
      setUpdateError(getErrorMessage(statusError, 'Unable to update ticket.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAssigneeChange(assigneeId: string) {
    if (activeTicket === undefined) return;
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateNotice(null);
    try {
      const updated = await updateTicketAssignee(
        activeTicket.id,
        assigneeId === 'unassigned' ? undefined : assigneeId,
        activeTicket.version,
      );
      const detail = await getTicketDetail(activeTicket.id);
      setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)));
      setSelectedTicketDetail(detail);
      setUpdateNotice(`Assignee updated to ${assigneeLabel(assigneeOptions, updated.assigneeId)}.`);
    } catch (assigneeError) {
      setUpdateError(getErrorMessage(assigneeError, 'Unable to update assignee.'));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddComment() {
    if (activeTicket === undefined || commentDraft.trim().length === 0) return;
    setIsCommenting(true);
    setUpdateError(null);
    setUpdateNotice(null);
    try {
      await addTicketComment(activeTicket.id, commentDraft.trim());
      const detail = await getTicketDetail(activeTicket.id);
      setSelectedTicketDetail(detail);
      setCommentDraft('');
      setUpdateNotice('Internal note added.');
    } catch (commentError) {
      setUpdateError(getErrorMessage(commentError, 'Unable to add comment.'));
    } finally {
      setIsCommenting(false);
    }
  }

  async function handleGradeConversation(
    conversation: ConversationLog,
    qaGrade: ConversationQaGrade,
    hallucinationFlag = conversation.hallucinationFlag,
  ) {
    setIsGrading(true);
    setQaNotice(null);
    setConversationsError(null);
    try {
      const updated = await gradeConversation(conversation.id, { qaGrade, hallucinationFlag });
      setConversations((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setQaNotice('Conversation grading saved.');
    } catch (gradeError) {
      setConversationsError(getErrorMessage(gradeError, 'Unable to save QA grade.'));
    } finally {
      setIsGrading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/internal-logout', { method: 'POST' });
    window.location.href = '/internal/login';
  }

  return (
    <main className="app-frame">
      <Sidebar
        activeView={activeView}
        onChangeView={setActiveView}
        health={health}
        healthError={healthError}
        onLogout={() => void handleLogout()}
      />

      <section className="workspace">
        <header className="page-head">
          <div>
            <p className="eyebrow">
              {activeView === 'operations' ? 'Managed support operations' : 'Quality control'}
            </p>
            <h2>{activeView === 'operations' ? 'Conversation Triage' : 'Manual QA Review'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </header>

        <MetricCards
          activeView={activeView}
          openTickets={openTickets}
          p1Tickets={p1Tickets}
          totalTickets={tickets.length}
          totalConversations={conversations.length}
          containmentRate={containmentRate}
          reviewedCount={reviewedConversations.length}
          hallucinationRate={hallucinationRate}
          averageConfidence={averageConfidence}
          ticketsError={ticketsError}
          conversationsError={conversationsError}
        />

        {updateError !== null && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            {updateError}
          </div>
        )}

        {activeView === 'qa' ? (
          <QaReview
            conversations={reviewConversations}
            qaNotice={qaNotice}
            conversationsError={conversationsError}
            isConversationsLoading={isConversationsLoading}
            isGrading={isGrading}
            onReload={() => void loadConversationsPanel()}
            onGrade={(conversation, grade, hallucinationFlag) =>
              void handleGradeConversation(conversation, grade, hallucinationFlag)
            }
          />
        ) : (
          <section className="triage-grid">
            <TicketsPanel
              tickets={filteredTickets}
              assigneeOptions={assigneeOptions}
              assigneeFilter={assigneeFilter}
              activeTicketId={activeTicket?.id}
              isTicketsLoading={isTicketsLoading}
              ticketsError={ticketsError}
              onChangeFilter={setAssigneeFilter}
              onReload={() => void loadTicketsPanel()}
              onSelectTicket={(ticket) => {
                setSelectedTicketId(ticket.id);
                setSelectedConversationId(ticket.conversationId);
              }}
            />

            <ConversationsPanel
              conversations={conversations}
              activeConversationId={selectedConversation?.id}
              isConversationsLoading={isConversationsLoading}
              conversationsError={conversationsError}
              onReload={() => void loadConversationsPanel()}
              onSelect={(conversation) => {
                setSelectedConversationId(conversation.id);
                setSelectedTicketId(conversation.ticketId ?? null);
              }}
            />

            <TicketDetailPanel
              activeTicket={activeTicket}
              selectedConversation={selectedConversation}
              selectedTicketDetail={selectedTicketDetail}
              assigneeOptions={assigneeOptions}
              isDetailLoading={isDetailLoading}
              detailError={detailError}
              updateNotice={updateNotice}
              isUpdating={isUpdating}
              isCommenting={isCommenting}
              commentDraft={commentDraft}
              onReloadDetail={(ticketId) => void loadTicketDetailPanel(ticketId)}
              onChangeStatus={(status) => void handleStatusChange(status)}
              onChangeAssignee={(assigneeId) => void handleAssigneeChange(assigneeId)}
              onChangeCommentDraft={setCommentDraft}
              onAddComment={() => void handleAddComment()}
            />
          </section>
        )}
      </section>
    </main>
  );
}
