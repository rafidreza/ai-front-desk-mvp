import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { NotFoundError } from '../errors';
import { createServices } from '../services';
import { jsonBody } from './helpers';

const GradeConversationSchema = z.object({
  qaGrade: z.enum(['good', 'bad']).optional().nullable(),
  hallucinationFlag: z.boolean().optional(),
  actorId: z.string().min(1).optional(),
});

const CalibrationQueueQuerySchema = z.object({
  filter: z.enum(['needs_review', 'failed', 'hallucination', 'escalation', 'ungraded', 'all']).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

const TakeoverConversationSchema = z.object({
  actorId: z.string().min(1).optional(),
});

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

export function conversationRoutes() {
  const app = new Hono<AppBindings>();

  app.get('/conversations', async (c) => c.json({ conversations: await createServices(c).conversations.listConversations() }));
  app.get('/tickets', async (c) => c.json({ tickets: await createServices(c).conversations.listTickets() }));

  app.get('/conversations/calibration-queue', async (c) => {
    const parsed = CalibrationQueueQuerySchema.parse(c.req.query());
    return c.json(await createServices(c).conversations.listCalibrationQueue(parsed));
  });

  app.patch('/conversations/:id/grade', async (c) => {
    const parsed = GradeConversationSchema.parse(await jsonBody(c));
    return c.json({
      conversation: await createServices(c).conversations.gradeConversation({
        conversationId: c.req.param('id'),
        qaGrade: parsed.qaGrade ?? undefined,
        hallucinationFlag: parsed.hallucinationFlag ?? false,
        actorId: parsed.actorId,
      }),
    });
  });

  app.post('/conversations/:id/takeover', async (c) => {
    const parsed = TakeoverConversationSchema.parse(await jsonBody(c));
    return c.json({ ticket: await createServices(c).conversations.takeOverConversation({ conversationId: c.req.param('id'), actorId: parsed.actorId }) });
  });

  app.get('/tickets/:id', async (c) => {
    const detail = await createServices(c).tickets.getDetail(c.req.param('id'));
    if (detail === null) throw new NotFoundError('Ticket not found.');
    return c.json(detail);
  });

  app.patch('/tickets/:id/status', async (c) => {
    const parsed = UpdateTicketStatusSchema.parse(await jsonBody(c));
    return c.json({
      ticket: await createServices(c).tickets.updateStatus({
        ticketId: c.req.param('id'),
        status: parsed.status,
        actorId: parsed.actorId,
        expectedVersion: parsed.expectedVersion,
      }),
    });
  });

  app.patch('/tickets/:id/assignee', async (c) => {
    const parsed = UpdateTicketAssigneeSchema.parse(await jsonBody(c));
    return c.json({
      ticket: await createServices(c).tickets.updateAssignee({
        ticketId: c.req.param('id'),
        assigneeId: parsed.assigneeId ?? undefined,
        actorId: parsed.actorId,
        expectedVersion: parsed.expectedVersion,
      }),
    });
  });

  app.post('/tickets/:id/comments', async (c) => {
    const parsed = AddTicketCommentSchema.parse(await jsonBody(c));
    return c.json({ comment: await createServices(c).tickets.addComment({ ticketId: c.req.param('id'), body: parsed.body, authorId: parsed.authorId }) });
  });

  return app;
}
