'use client';

import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  addTicketComment,
  getConversations,
  getInternalUsers,
  getTicketDetail,
  getTickets,
  updateTicketAssignee,
  updateTicketStatus,
} from '@/lib/api';
import { ConversationLog, InternalUser, Ticket, TicketDetail, TicketStatus } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { TicketDetailPanel } from '../_components/TicketDetailPanel';
import { TicketsPanel } from '../_components/TicketsPanel';
import { assigneeLabel, getErrorMessage, statusLabels } from '../_lib/helpers';

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  return `"${raw.replaceAll('"', '""')}"`;
}

function downloadTicketsCsv(tickets: Ticket[], assigneeOptions: InternalUser[]) {
  const rows = [
    [
      'Ticket ID',
      'Priority',
      'Status',
      'Assignee',
      'Reason',
      'Customer Message',
      'Suggested Reply',
      'Recovered Sales Estimate',
      'Created At',
      'Updated At',
    ],
    ...tickets.map((ticket) => [
      ticket.id,
      ticket.priority,
      statusLabels[ticket.status],
      assigneeLabel(assigneeOptions, ticket.assigneeId),
      ticket.reason,
      ticket.customerMessage,
      ticket.suggestedReply,
      ticket.salesRecoveredEstimate,
      ticket.createdAt,
      ticket.updatedAt,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ai-front-desk-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<InternalUser[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [requestedTicketId, setRequestedTicketId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<TicketDetail | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isTicketsLoading, setIsTicketsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  async function loadTicketsData(nextRequestedTicketId = requestedTicketId) {
    setIsTicketsLoading(true);
    setTicketsError(null);
    try {
      const [ticketData, conversationData, userData] = await Promise.all([
        getTickets(),
        getConversations(),
        getInternalUsers(),
      ]);
      setTickets(ticketData);
      setConversations(conversationData);
      setAssigneeOptions(userData);
      setSelectedTicketId((current) => current ?? nextRequestedTicketId ?? ticketData[0]?.id ?? null);
    } catch (error) {
      setTicketsError(getErrorMessage(error, 'Unable to load tickets.'));
    } finally {
      setIsTicketsLoading(false);
    }
  }

  async function loadTicketDetail(ticketId: string) {
    setIsDetailLoading(true);
    setDetailError(null);
    try {
      setSelectedTicketDetail(await getTicketDetail(ticketId));
    } catch (error) {
      setDetailError(getErrorMessage(error, 'Unable to load ticket detail.'));
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    const nextRequestedTicketId = new URLSearchParams(window.location.search).get('ticketId');
    setRequestedTicketId(nextRequestedTicketId);
    void loadTicketsData(nextRequestedTicketId);
  }, []);

  useEffect(() => {
    if (selectedTicketId === null) {
      setSelectedTicketDetail(null);
      return;
    }
    void loadTicketDetail(selectedTicketId);
  }, [selectedTicketId]);

  const filteredTickets = useMemo(() => {
    if (assigneeFilter === 'all') return tickets;
    if (assigneeFilter === 'unassigned') return tickets.filter((ticket) => ticket.assigneeId === undefined);
    return tickets.filter((ticket) => ticket.assigneeId === assigneeFilter);
  }, [assigneeFilter, tickets]);

  const activeTicket = useMemo(
    () => selectedTicketDetail?.ticket ?? tickets.find((ticket) => ticket.id === selectedTicketId),
    [selectedTicketDetail, selectedTicketId, tickets],
  );
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeTicket?.conversationId),
    [activeTicket, conversations],
  );

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
    } catch (error) {
      setUpdateError(getErrorMessage(error, 'Unable to update ticket.'));
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
    } catch (error) {
      setUpdateError(getErrorMessage(error, 'Unable to update assignee.'));
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
      setSelectedTicketDetail(await getTicketDetail(activeTicket.id));
      setCommentDraft('');
      setUpdateNotice('Internal note added.');
    } catch (error) {
      setUpdateError(getErrorMessage(error, 'Unable to add comment.'));
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <InternalShell
      activeView="tickets"
      eyebrow="Ticket portal"
      title="Tickets, ownership, and follow-up"
      action={
        <div className="page-actions">
          <button className="icon-button" type="button" onClick={() => downloadTicketsCsv(filteredTickets, assigneeOptions)}>
            <Download size={16} />
            Export CSV
          </button>
          <button className="icon-button" type="button" onClick={() => void loadTicketsData()} disabled={isTicketsLoading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >
      {updateError !== null && <div className="inline-alert">{updateError}</div>}
      <section className="ticket-portal-grid">
        <TicketsPanel
          tickets={filteredTickets}
          assigneeOptions={assigneeOptions}
          assigneeFilter={assigneeFilter}
          activeTicketId={activeTicket?.id}
          isTicketsLoading={isTicketsLoading}
          ticketsError={ticketsError}
          onChangeFilter={setAssigneeFilter}
          onReload={() => void loadTicketsData()}
          onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
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
          onReloadDetail={(ticketId) => void loadTicketDetail(ticketId)}
          onChangeStatus={(status) => void handleStatusChange(status)}
          onChangeAssignee={(assigneeId) => void handleAssigneeChange(assigneeId)}
          onChangeCommentDraft={setCommentDraft}
          onAddComment={() => void handleAddComment()}
        />
      </section>
    </InternalShell>
  );
}
