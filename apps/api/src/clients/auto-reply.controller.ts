import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { AutoReplyService } from './auto-reply.service';

const AutoReplyRuleSchema = z.object({
  ruleType: z.enum(['holiday', 'off_hours']),
  label: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(3).max(80).optional(),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startMinute: z.number().int().min(0).max(1440).optional(),
  endMinute: z.number().int().min(0).max(1440).optional(),
  replyText: z.string().trim().min(2).max(1000),
  enabled: z.boolean().optional(),
});

@Controller('clients/:clientId/auto-replies')
export class AutoReplyController {
  constructor(private readonly autoReplies: AutoReplyService) {}

  @Get()
  async listRules(@Param('clientId') clientId: string) {
    return { rules: await this.autoReplies.list(clientId) };
  }

  @Post()
  async createRule(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = AutoReplyRuleSchema.parse(body);
    return { rule: await this.autoReplies.create(clientId, parsed) };
  }

  @Patch(':ruleId')
  async updateRule(@Param('clientId') clientId: string, @Param('ruleId') ruleId: string, @Body() body: unknown) {
    const parsed = AutoReplyRuleSchema.partial().parse(body);
    return { rule: await this.autoReplies.update(clientId, ruleId, parsed) };
  }

  @Delete(':ruleId')
  async deleteRule(@Param('clientId') clientId: string, @Param('ruleId') ruleId: string) {
    await this.autoReplies.delete(clientId, ruleId);
    return { ok: true };
  }
}
