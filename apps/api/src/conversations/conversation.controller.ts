import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { z } from 'zod';
import { ConversationService } from './conversation.service';

const GradeConversationSchema = z.object({
  qaGrade: z.enum(['good', 'bad']).optional().nullable(),
  hallucinationFlag: z.boolean().optional(),
  actorId: z.string().min(1).optional(),
});

const CalibrationQueueQuerySchema = z.object({
  filter: z
    .enum(['needs_review', 'failed', 'hallucination', 'escalation', 'ungraded', 'all'])
    .optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

@Controller()
export class ConversationController {
  constructor(private readonly conversations: ConversationService) {}

  @Get('conversations')
  async listConversations() {
    return {
      conversations: await this.conversations.listConversations(),
    };
  }

  @Get('tickets')
  async listTickets() {
    return {
      tickets: await this.conversations.listTickets(),
    };
  }

  @Get('conversations/calibration-queue')
  async calibrationQueue(@Query() query: unknown) {
    const parsed = CalibrationQueueQuerySchema.parse(query);
    return this.conversations.listCalibrationQueue(parsed);
  }

  @Patch('conversations/:id/grade')
  async gradeConversation(@Param('id') conversationId: string, @Body() body: unknown) {
    const parsed = GradeConversationSchema.parse(body);
    const conversation = await this.conversations.gradeConversation({
      conversationId,
      qaGrade: parsed.qaGrade ?? undefined,
      hallucinationFlag: parsed.hallucinationFlag ?? false,
      actorId: parsed.actorId,
    });

    return { conversation };
  }
}
