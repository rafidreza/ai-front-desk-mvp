import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { BlockedSenderService } from './blocked-sender.service';

const BlockSenderSchema = z.object({
  channel: z.enum(['messenger', 'whatsapp', 'web']),
  externalSenderId: z.string().trim().min(1),
  reason: z.string().trim().max(280).optional(),
  blockedBy: z.string().trim().min(1).optional(),
});

@Controller()
export class BlockedSenderController {
  constructor(private readonly blocks: BlockedSenderService) {}

  @Get('clients/:clientId/blocked-senders')
  async list(@Param('clientId') clientId: string) {
    const blocks = await this.blocks.list(clientId);
    return { blocks };
  }

  @Post('clients/:clientId/blocked-senders')
  async block(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = BlockSenderSchema.parse(body);
    const block = await this.blocks.block({
      clientId,
      channel: parsed.channel,
      externalSenderId: parsed.externalSenderId,
      reason: parsed.reason,
      blockedBy: parsed.blockedBy ?? 'internal-console',
    });
    return { block };
  }

  @Delete('clients/:clientId/blocked-senders/:blockId')
  async unblock(@Param('clientId') clientId: string, @Param('blockId') blockId: string) {
    await this.blocks.unblock(clientId, blockId);
    return { ok: true };
  }
}
