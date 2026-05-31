'use client';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MessageSquareWarning,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TicketCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  getCalibrationQueue,
  getClients,
  getInternalKnowledgeRequests,
  getTickets,
} from '@/lib/api';
import {
  CalibrationQueueResult,
  ClientProfile,
  ConversationLog,
  KnowledgeChangeRequest,
  Ticket,
} from '@/types/domain';
import { EmptyState } from '../_components/EmptyState';
import { InternalShell } from '../_components/InternalShell';
import { ListSkeleton } from '../_components/ListSkeleton';
import { getErrorMessage } from '../_lib/helpers';

type ImprovementLaneId = 'review' | 'kb_fix' | 'reply_test' | 'shadow_watch' | 'friday_report';

type ImprovementCard = {
  id: string;
  title: string;
  detail: string;
  clientName: string;
  source: string;
  href: string;
  priority: 'P1' | 'P2' | 'P3';
  ageLabel?: string;
};

const lanes: Array<{
  id: ImprovementLaneId;
  day: string;
  title: string;
  hint: string;
}> = [
  {
    id: 'review',
    day: 'Monday',
    title: 'Review risky replies',
    hint: 'Start with conversations the AI marked as risky.',
  },
  {
    id: 'kb_fix',
    day: 'Tuesday',
    title: 'Fix knowledge gaps',
    hint: 'Approve, reject, or clarify pending KB suggestions.',
  },
  {
    id: 'reply_test',
    day: 'Wednesday',
    title: 'Test corrected replies',
    hint: 'Use failed QA signals to tune prompts and answers.',
  },
  {
    id: 'shadow_watch',
    day: 'Thursday',
    title: 'Watch live handoffs',
    hint: 'Check urgent tickets before the weekly report.',
  },
  {
    id: 'friday_report',
    day: 'Friday',
    title: 'Package the week',
    hint: 'Summarize fixes shipped and customer issues closed.',
  },
];

function latestConversationAt(conversation: ConversationLog) {
  const latestMessage = conversation.messages.at(-1);
  return latestMessage?.createdAt ?? conversation.autoQaAt ?? conversation.gradedAt;
}

function ageLabel(value?: string) {
  if (value === undefined) return undefined;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return undefined;
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function shortText(value: string, max = 118) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}...`;
}

function clientName(clients: Map<string, ClientProfile>, clientId: string) {
  return clients.get(clientId)?.businessName ?? clientId;
}

function ticketPriority(ticket: Ticket): ImprovementCard['priority'] {
  return ticket.priority;
}

function conversationPriority(conversation: ConversationLog): ImprovementCard['priority'] {
  if (conversation.hallucinationFlag || conversation.autoQaDefects.includes('hallucination_risk')) return 'P1';
  if (conversation.autoQaGrade === 'fail' || (conversation.lastConfidence ?? 1) < 0.45) return 'P2';
  return 'P3';
}

function knowledgePriority(request: KnowledgeChangeRequest): ImprovementCard['priority'] {
  if (request.urgency === 'urgent') return 'P1';
  if (request.status === 'needs_clarification') return 'P2';
  return 'P3';
}

function buildBoard(input: {
  clients: ClientProfile[];
  tickets: Ticket[];
  calibration: CalibrationQueueResult | null;
  knowledgeRequests: KnowledgeChangeRequest[];
}) {
  const clientsById = new Map(input.clients.map((client) => [client.id, client]));
  const activeTickets = input.tickets.filter((ticket) => ticket.status !== 'resolved');
  const closedTickets = input.tickets.filter((ticket) => ticket.status === 'resolved');
  const riskyConversations = input.calibration?.conversations ?? [];

  const review = riskyConversations
    .filter((conversation) => conversation.qaGrade === undefined)
    .slice(0, 8)
    .map((conversation): ImprovementCard => ({
      id: `review:${conversation.id}`,
      title: conversation.autoQaReason ?? 'QA review needed',
      detail: shortText(conversation.messages.at(-1)?.text ?? 'No message text recorded.'),
      clientName: clientName(clientsById, conversation.clientId),
      source: conversation.autoQaGrade === undefined ? 'manual QA' : `auto QA: ${conversation.autoQaGrade}`,
      href: conversation.ticketId !== undefined
        ? `/internal/tickets?ticketId=${conversation.ticketId}`
        : '/internal/conversations',
      priority: conversationPriority(conversation),
      ageLabel: ageLabel(latestConversationAt(conversation)),
    }));

  const kbFix = input.knowledgeRequests
    .filter((request) => ['submitted', 'in_review', 'needs_clarification'].includes(request.status))
    .sort((a, b) => Number(b.urgency === 'urgent') - Number(a.urgency === 'urgent'))
    .slice(0, 8)
    .map((request): ImprovementCard => ({
      id: `kb:${request.id}`,
      title: request.proposedTitle,
      detail: shortText(request.proposedAnswer),
      clientName: clientName(clientsById, request.clientId),
      source: `${request.requestType} request: ${request.status.replace(/_/g, ' ')}`,
      href: `/internal/kb-review?requestId=${request.id}`,
      priority: knowledgePriority(request),
      ageLabel: ageLabel(request.updatedAt),
    }));

  const replyTest = riskyConversations
    .filter((conversation) =>
      conversation.qaGrade === 'bad' ||
      conversation.hallucinationFlag ||
      conversation.autoQaGrade === 'fail' ||
      conversation.autoQaDefects.length > 0,
    )
    .slice(0, 8)
    .map((conversation): ImprovementCard => ({
      id: `test:${conversation.id}`,
      title: conversation.autoQaDefects.length > 0
        ? conversation.autoQaDefects.map((defect) => defect.replace(/_/g, ' ')).join(', ')
        : 'Reply needs retest',
      detail: shortText(conversation.autoQaReason ?? conversation.messages.at(-1)?.text ?? 'Open the conversation and retest the answer.'),
      clientName: clientName(clientsById, conversation.clientId),
      source: conversation.qaGrade === 'bad' ? 'human QA: bad' : 'auto QA signal',
      href: conversation.ticketId !== undefined
        ? `/internal/tickets?ticketId=${conversation.ticketId}`
        : '/internal/conversations',
      priority: conversationPriority(conversation),
      ageLabel: ageLabel(latestConversationAt(conversation)),
    }));

  const shadowWatch = activeTickets
    .filter((ticket) => ticket.priority === 'P1' || ticket.priority === 'P2')
    .slice(0, 8)
    .map((ticket): ImprovementCard => ({
      id: `ticket:${ticket.id}`,
      title: ticket.reason,
      detail: shortText(ticket.customerMessage),
      clientName: clientName(clientsById, ticket.clientId),
      source: `${ticket.priority} ticket: ${ticket.status.replace(/_/g, ' ')}`,
      href: `/internal/tickets?ticketId=${ticket.id}`,
      priority: ticketPriority(ticket),
      ageLabel: ageLabel(ticket.updatedAt),
    }));

  const fridayReport = [
    ...closedTickets.slice(0, 4).map((ticket): ImprovementCard => ({
      id: `closed:${ticket.id}`,
      title: 'Closed customer issue',
      detail: shortText(ticket.reason),
      clientName: clientName(clientsById, ticket.clientId),
      source: `${ticket.priority} resolved ticket`,
      href: `/internal/tickets?ticketId=${ticket.id}`,
      priority: 'P3',
      ageLabel: ageLabel(ticket.updatedAt),
    })),
    ...input.knowledgeRequests
      .filter((request) => ['published', 'approved', 'edited_then_published'].includes(request.status))
      .slice(0, 4)
      .map((request): ImprovementCard => ({
        id: `shipped:${request.id}`,
        title: 'Knowledge update shipped',
        detail: shortText(request.proposedTitle),
        clientName: clientName(clientsById, request.clientId),
        source: request.status.replace(/_/g, ' '),
        href: `/internal/kb-review?requestId=${request.id}`,
        priority: 'P3',
        ageLabel: ageLabel(request.updatedAt),
      })),
  ].slice(0, 8);

  return {
    review,
    kb_fix: kbFix,
    reply_test: replyTest,
    shadow_watch: shadowWatch,
    friday_report: fridayReport,
  } satisfies Record<ImprovementLaneId, ImprovementCard[]>;
}

function CardIcon({ source }: { source: string }) {
  if (source.includes('ticket')) return <TicketCheck size={15} />;
  if (source.includes('request') || source.includes('Knowledge')) return <ClipboardList size={15} />;
  if (source.includes('QA')) return <ShieldCheck size={15} />;
  return <MessageSquareWarning size={15} />;
}

export default function ImprovementPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calibration, setCalibration] = useState<CalibrationQueueResult | null>(null);
  const [knowledgeRequests, setKnowledgeRequests] = useState<KnowledgeChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBoard() {
    setIsLoading(true);
    setError(null);
    try {
      const [clientData, ticketData, calibrationData, requestData] = await Promise.all([
        getClients(),
        getTickets(),
        getCalibrationQueue('all'),
        getInternalKnowledgeRequests({ status: 'all', urgency: 'all' }),
      ]);
      setClients(clientData);
      setTickets(ticketData);
      setCalibration(calibrationData);
      setKnowledgeRequests(requestData);
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Improvement board could not load. Fix: refresh after confirming the API is reachable.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  const board = useMemo(
    () => buildBoard({ clients, tickets, calibration, knowledgeRequests }),
    [calibration, clients, knowledgeRequests, tickets],
  );

  const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved').length;
  const pendingKb = knowledgeRequests.filter((request) => ['submitted', 'in_review', 'needs_clarification'].includes(request.status)).length;
  const riskyQa = calibration?.summary.failed ?? 0;
  const shippedCount =
    tickets.filter((ticket) => ticket.status === 'resolved').length +
    knowledgeRequests.filter((request) => ['published', 'approved', 'edited_then_published'].includes(request.status)).length;

  return (
    <InternalShell
      activeView="improvement"
      eyebrow="Improvement loop"
      title="Weekly QA and launch fixes"
      action={
        <div className="page-actions">
          <button className="icon-button" disabled={isLoading} onClick={() => void loadBoard()} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      }
    >
      {error !== null && <div className="inline-alert">{error}</div>}

      <section className="improvement-summary" aria-label="Improvement metrics">
        <div>
          <span><AlertTriangle size={15} /> Open tickets</span>
          <strong>{openTickets}</strong>
        </div>
        <div>
          <span><ClipboardList size={15} /> Pending KB fixes</span>
          <strong>{pendingKb}</strong>
        </div>
        <div>
          <span><ShieldCheck size={15} /> Failed QA signals</span>
          <strong>{riskyQa}</strong>
        </div>
        <div>
          <span><CheckCircle2 size={15} /> Shipped signals</span>
          <strong>{shippedCount}</strong>
        </div>
      </section>

      {isLoading ? (
        <ListSkeleton rows={5} variant="qa" />
      ) : (
        <section className="improvement-board" aria-label="Weekly improvement kanban">
          {lanes.map((lane) => {
            const cards = board[lane.id];
            return (
              <article className="improvement-lane" data-lane={lane.id} key={lane.id}>
                <header>
                  <div>
                    <span>{lane.day}</span>
                    <strong>{lane.title}</strong>
                    <small>{lane.hint}</small>
                  </div>
                  <b>{cards.length}</b>
                </header>

                <div className="improvement-cards">
                  {cards.length === 0 ? (
                    <EmptyState
                      icon={<Sparkles size={18} />}
                      title="Nothing queued"
                      description="This lane is clear based on the current tickets, QA queue, and KB review queue."
                    />
                  ) : (
                    cards.map((card) => (
                      <article className="improvement-card" data-priority={card.priority} key={card.id}>
                        <div className="improvement-card__topline">
                          <span>
                            <CardIcon source={card.source} />
                            {card.source}
                          </span>
                          <b>{card.priority}</b>
                        </div>
                        <strong>{card.title}</strong>
                        <p>{card.detail}</p>
                        <div className="improvement-card__meta">
                          <span>{card.clientName}</span>
                          {card.ageLabel !== undefined && <span>{card.ageLabel}</span>}
                        </div>
                        <Link className="mini-button" href={card.href}>
                          Open
                          <ArrowRight size={13} />
                        </Link>
                      </article>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </InternalShell>
  );
}
