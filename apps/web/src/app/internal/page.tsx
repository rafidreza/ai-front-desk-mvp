'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getCalibrationQueue,
  getConversations,
  getInternalUsers,
  getTickets,
  gradeConversation,
} from '@/lib/api';
import {
  CalibrationQueueFilter,
  CalibrationQueueSummary,
  ConversationLog,
  ConversationQaGrade,
  InternalUser,
  Ticket,
} from '@/types/domain';
import { ConversationsPanel } from './_components/ConversationsPanel';
import { InternalShell } from './_components/InternalShell';
import { MetricCards } from './_components/MetricCards';
import { QaReview } from './_components/QaReview';
import { TicketsPanel } from './_components/TicketsPanel';
import { getErrorMessage } from './_lib/helpers';

export default function InternalConsole() {
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [calibrationConversations, setCalibrationConversations] = useState<ConversationLog[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<InternalUser[]>([]);
  const [activeView, setActiveView] = useState<'operations' | 'qa'>('operations');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [qaFilter, setQaFilter] = useState<CalibrationQueueFilter>('all');
  const [queueSummary, setQueueSummary] = useState<CalibrationQueueSummary | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [qaNotice, setQaNotice] = useState<string | null>(null);

  async function loadConversationsPanel() {
    setIsConversationsLoading(true);
    setConversationsError(null);
    try {
      const conversationData = await getConversations();
      setConversations(conversationData);
      setSelectedConversationId((current) => current ?? conversationData[0]?.id ?? null);
    } catch (loadError) {
      setConversationsError(getErrorMessage(loadError, 'Conversations could not load from the API. Fix: confirm the API server is running, then refresh.'));
    } finally {
      setIsConversationsLoading(false);
    }
  }

  async function loadCalibrationQueuePanel(nextFilter = qaFilter) {
    setIsConversationsLoading(true);
    setConversationsError(null);
    try {
      const queue = await getCalibrationQueue(nextFilter);
      setCalibrationConversations(queue.conversations);
      setQueueSummary(queue.summary);
    } catch (loadError) {
      setConversationsError(getErrorMessage(loadError, 'QA calibration queue could not load. Fix: refresh the selected filter after confirming the API server is running.'));
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
      setTicketsError(getErrorMessage(loadError, 'Tickets could not load from the API. Fix: confirm the API server is running, then refresh.'));
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
    await Promise.all([
      loadConversationsPanel(),
      loadCalibrationQueuePanel(),
      loadTicketsPanel(),
      loadUsersPanel(),
    ]);
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'qa') {
      setActiveView('qa');
    }
    void loadData();
  }, []);

  const filteredTickets = useMemo(() => {
    if (assigneeFilter === 'all') return tickets;
    if (assigneeFilter === 'unassigned') return tickets.filter((ticket) => ticket.assigneeId === undefined);
    return tickets.filter((ticket) => ticket.assigneeId === assigneeFilter);
  }, [assigneeFilter, tickets]);

  const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved').length;
  const p1Tickets = tickets.filter((ticket) => ticket.priority === 'P1').length;
  const reviewConversations = conversations.slice(0, 100);
  const queueConversations = calibrationConversations.slice(0, 100);
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
  const isLoading = isTicketsLoading || isConversationsLoading;

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
      setCalibrationConversations((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .filter((item) => qaFilter === 'all' || item.qaGrade === undefined),
      );
      setQaNotice('Conversation grading saved.');
    } catch (gradeError) {
      setConversationsError(getErrorMessage(gradeError, 'QA grade could not be saved. Fix: refresh the queue, then retry the grade.'));
    } finally {
      setIsGrading(false);
    }
  }

  return (
    <InternalShell
      activeView={activeView}
      eyebrow={activeView === 'operations' ? 'Managed support operations' : 'Quality control'}
      title={activeView === 'operations' ? 'Conversation Triage' : 'Manual QA Review'}
      onChangeView={setActiveView}
      action={
        <button className="icon-button" type="button" onClick={() => void loadData()} disabled={isLoading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      }
    >
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

      {activeView === 'qa' ? (
        <QaReview
          conversations={queueConversations}
          queueFilter={qaFilter}
          queueSummary={queueSummary}
          qaNotice={qaNotice}
          conversationsError={conversationsError}
          isConversationsLoading={isConversationsLoading}
          isGrading={isGrading}
          onChangeFilter={(filter) => {
            setQaFilter(filter);
            void loadCalibrationQueuePanel(filter);
          }}
          onReload={() => void loadCalibrationQueuePanel()}
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
            activeTicketId={selectedTicketId ?? undefined}
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
        </section>
      )}
    </InternalShell>
  );
}
