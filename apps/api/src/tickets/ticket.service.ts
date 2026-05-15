import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConversationRepository } from '../conversations/conversation.repository';
import { AgentReply, IncomingMessage, Ticket, TicketComment, TicketDetail, TicketPriority, TicketStatus } from '../types/domain';

@Injectable()
export class TicketService {
  constructor(private readonly repository: ConversationRepository) {}

  async createFromEscalation(input: {
    message: IncomingMessage;
    conversationId: string;
    reply: AgentReply;
  }): Promise<Ticket> {
    const now = new Date().toISOString();
    const priority = this.getPriority(input.reply.escalationReason ?? '');

    return this.repository.saveTicket({
      id: randomUUID(),
      clientId: input.message.clientId,
      conversationId: input.conversationId,
      version: 0,
      priority,
      status: 'open',
      reason: input.reply.escalationReason ?? 'Escalated by AI',
      customerMessage: input.message.text,
      suggestedReply: input.reply.text,
      salesRecoveredEstimate: this.estimateRecoveredSales(priority),
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateStatus(input: {
    ticketId: string;
    status: TicketStatus;
    actorId?: string;
    expectedVersion?: number;
  }): Promise<Ticket> {
    return this.repository.updateTicketStatus({
      ticketId: input.ticketId,
      status: input.status,
      actorId: input.actorId ?? 'internal-operator',
      expectedVersion: input.expectedVersion,
    });
  }

  async getDetail(ticketId: string): Promise<TicketDetail | null> {
    return this.repository.getTicketDetail(ticketId);
  }

  async updateAssignee(input: {
    ticketId: string;
    assigneeId?: string;
    actorId?: string;
    expectedVersion?: number;
  }): Promise<Ticket> {
    return this.repository.updateTicketAssignee({
      ticketId: input.ticketId,
      assigneeId: input.assigneeId,
      actorId: input.actorId ?? 'internal-operator',
      expectedVersion: input.expectedVersion,
    });
  }

  async addComment(input: { ticketId: string; body: string; authorId?: string }): Promise<TicketComment> {
    return this.repository.addTicketComment({
      ticketId: input.ticketId,
      body: input.body,
      authorId: input.authorId ?? 'internal-operator',
    });
  }

  private getPriority(reason: string): TicketPriority {
    const normalizedReason = reason.toLowerCase();
    if (
      normalizedReason.includes('refund') ||
      normalizedReason.includes('complaint') ||
      normalizedReason.includes('angry') ||
      normalizedReason.includes('রিফান্ড') ||
      normalizedReason.includes('অভিযোগ')
    ) {
      return 'P1';
    }

    if (normalizedReason.includes('low knowledge confidence')) {
      return 'P2';
    }

    return 'P3';
  }

  private estimateRecoveredSales(priority: TicketPriority): number {
    if (priority === 'P1') return 2500;
    if (priority === 'P2') return 1200;
    return 500;
  }
}
