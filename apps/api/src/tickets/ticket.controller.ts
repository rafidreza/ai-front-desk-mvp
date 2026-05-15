import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { TicketService } from './ticket.service';

const UpdateTicketStatusSchema = z.object({
  status: z.enum(['open', 'assigned', 'waiting_client', 'resolved']),
  actorId: z.string().min(1).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

const UpdateTicketAssigneeSchema = z.object({
  assigneeId: z.string().trim().min(1).optional().nullable(),
  actorId: z.string().min(1).optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

const AddTicketCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  authorId: z.string().min(1).optional(),
});

@Controller('tickets')
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  @Get(':id')
  async getDetail(@Param('id') ticketId: string) {
    const detail = await this.tickets.getDetail(ticketId);
    if (detail === null) {
      throw new NotFoundException('Ticket not found.');
    }

    return detail;
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') ticketId: string, @Body() body: unknown) {
    const parsed = UpdateTicketStatusSchema.parse(body);
    const ticket = await this.tickets.updateStatus({
      ticketId,
      status: parsed.status,
      actorId: parsed.actorId,
      expectedVersion: parsed.expectedVersion,
    });

    return { ticket };
  }

  @Patch(':id/assignee')
  async updateAssignee(@Param('id') ticketId: string, @Body() body: unknown) {
    const parsed = UpdateTicketAssigneeSchema.parse(body);
    const ticket = await this.tickets.updateAssignee({
      ticketId,
      assigneeId: parsed.assigneeId ?? undefined,
      actorId: parsed.actorId,
      expectedVersion: parsed.expectedVersion,
    });

    return { ticket };
  }

  @Post(':id/comments')
  async addComment(@Param('id') ticketId: string, @Body() body: unknown) {
    const parsed = AddTicketCommentSchema.parse(body);
    const comment = await this.tickets.addComment({
      ticketId,
      body: parsed.body,
      authorId: parsed.authorId,
    });

    return { comment };
  }
}
