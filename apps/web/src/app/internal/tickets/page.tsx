'use client';

import { Download, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  addTicketComment,
  bulkApplyTag,
  createTag,
  getConversations,
  getInternalUsers,
  getTags,
  getTicketDetail,
  getTickets,
  updateTicketAssignee,
  updateTicketStatus,
} from '@/lib/api';
import { ConversationLog, InternalUser, Tag, TagColor, Ticket, TicketDetail, TicketStatus } from '@/types/domain';
import { InternalShell } from '../_components/InternalShell';
import { BulkActionBar } from '../_components/BulkActionBar';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagsByClient, setTagsByClient] = useState<Record<string, Tag[]>>({});
  const [isBulkBusy, setIsBulkBusy] = useState(false);

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
      setTicketsError(getErrorMessage(error, 'Tickets could not load from the API. Fix: confirm the API server is running, then refresh.'));
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
      setDetailError(getErrorMessage(error, 'Ticket detail could not load. Fix: select the ticket again or refresh the queue.'));
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

  const selectedTickets = useMemo(
    () => tickets.filter((ticket) => selectedIds.has(ticket.id)),
    [tickets, selectedIds],
  );
  const selectedClientIds = useMemo(
    () => new Set(selectedTickets.map((ticket) => ticket.clientId)),
    [selectedTickets],
  );
  const sameClient = selectedClientIds.size === 1;
  const sharedClientId = sameClient ? Array.from(selectedClientIds)[0] : null;
  const availableTags = sharedClientId !== null ? tagsByClient[sharedClientId] ?? [] : [];

  useEffect(() => {
    if (sharedClientId === null || tagsByClient[sharedClientId] !== undefined) return;
    let cancelled = false;
    void getTags(sharedClientId)
      .then((tags) => {
        if (!cancelled) {
          setTagsByClient((current) => ({ ...current, [sharedClientId]: tags }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTagsByClient((current) => ({ ...current, [sharedClientId]: [] }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sharedClientId, tagsByClient]);

  function toggleSelect(ticketId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(ticketId);
      else next.delete(ticketId);
      return next;
    });
  }

  function toggleSelectAll(selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const ticket of filteredTickets) {
        if (selected) next.add(ticket.id);
        else next.delete(ticket.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runBulk<T>(label: string, fn: () => Promise<T>) {
    setIsBulkBusy(true);
    setUpdateError(null);
    setUpdateNotice(null);
    try {
      const result = await fn();
      setUpdateNotice(label);
      await loadTicketsData();
      return result;
    } catch (error) {
      setUpdateError(getErrorMessage(error, `Could not complete bulk ${label.toLowerCase()}.`));
      throw error;
    } finally {
      setIsBulkBusy(false);
    }
  }

  async function handleBulkClose() {
    if (selectedTickets.length === 0) return;
    await runBulk(`Marked ${selectedTickets.length} ticket(s) resolved.`, async () => {
      await Promise.all(
        selectedTickets
          .filter((ticket) => ticket.status !== 'resolved')
          .map((ticket) => updateTicketStatus(ticket.id, 'resolved', ticket.version)),
      );
      clearSelection();
    });
  }

  async function handleBulkAssign(assigneeId: string) {
    if (selectedTickets.length === 0) return;
    const nextAssignee = assigneeId === 'unassigned' ? undefined : assigneeId;
    await runBulk(`Assigned ${selectedTickets.length} ticket(s).`, async () => {
      await Promise.all(
        selectedTickets.map((ticket) => updateTicketAssignee(ticket.id, nextAssignee, ticket.version)),
      );
      clearSelection();
    });
  }

  async function handleBulkApplyTag(tagId: string) {
    if (sharedClientId === null || selectedTickets.length === 0) return;
    await runBulk(`Tag applied to ${selectedTickets.length} ticket(s).`, async () => {
      await bulkApplyTag(sharedClientId, selectedTickets.map((ticket) => ticket.id), tagId);
    });
  }

  async function handleCreateTagForBulk(name: string, color: TagColor): Promise<Tag> {
    if (sharedClientId === null) {
      throw new Error('Pick tickets from a single client to create a tag.');
    }
    const tag = await createTag(sharedClientId, name, color);
    setTagsByClient((current) => ({
      ...current,
      [sharedClientId]: [...(current[sharedClientId] ?? []), tag],
    }));
    return tag;
  }

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
      setUpdateError(getErrorMessage(error, 'Ticket status could not be saved. Fix: refresh to get the latest ticket version, then retry.'));
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
      setUpdateError(getErrorMessage(error, 'Ticket owner could not be saved. Fix: refresh owners and retry.'));
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
      setUpdateError(getErrorMessage(error, 'Internal note could not be saved. Fix: check the API connection, then retry.'));
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
      <BulkActionBar
        selectedCount={selectedTickets.length}
        sameClient={sameClient}
        isBusy={isBulkBusy}
        assigneeOptions={assigneeOptions}
        availableTags={availableTags}
        onClose={() => void handleBulkClose()}
        onAssign={(assigneeId) => void handleBulkAssign(assigneeId)}
        onApplyTag={(tagId) => void handleBulkApplyTag(tagId)}
        onCreateTag={handleCreateTagForBulk}
        onClearSelection={clearSelection}
      />
      <section className="ticket-portal-grid">
        <TicketsPanel
          tickets={filteredTickets}
          assigneeOptions={assigneeOptions}
          assigneeFilter={assigneeFilter}
          activeTicketId={activeTicket?.id}
          isTicketsLoading={isTicketsLoading}
          ticketsError={ticketsError}
          selectedIds={selectedIds}
          onChangeFilter={setAssigneeFilter}
          onReload={() => void loadTicketsData()}
          onSelectTicket={(ticket) => setSelectedTicketId(ticket.id)}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
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
