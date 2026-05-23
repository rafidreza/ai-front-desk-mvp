import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { TAG_COLORS } from '../types/domain';
import { TagService } from './tag.service';

const CreateTagSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: z.enum(TAG_COLORS as [string, ...string[]]),
});

const UpdateTagSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  color: z.enum(TAG_COLORS as [string, ...string[]]).optional(),
});

const ApplyTagSchema = z.object({
  tagId: z.string().min(1),
});

const BulkApplySchema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1).max(200),
  tagId: z.string().min(1),
});

@Controller()
export class TagController {
  constructor(private readonly tags: TagService) {}

  @Get('clients/:clientId/tags')
  async list(@Param('clientId') clientId: string) {
    const tags = await this.tags.list(clientId);
    return { tags };
  }

  @Post('clients/:clientId/tags')
  async create(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = CreateTagSchema.parse(body);
    const tag = await this.tags.create(clientId, parsed);
    return { tag };
  }

  @Patch('clients/:clientId/tags/:tagId')
  async update(
    @Param('clientId') clientId: string,
    @Param('tagId') tagId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateTagSchema.parse(body);
    const tag = await this.tags.update(clientId, tagId, parsed);
    return { tag };
  }

  @Delete('clients/:clientId/tags/:tagId')
  async remove(@Param('clientId') clientId: string, @Param('tagId') tagId: string) {
    await this.tags.delete(clientId, tagId);
    return { ok: true };
  }

  @Post('tickets/:ticketId/tags')
  async addToTicket(@Param('ticketId') ticketId: string, @Body() body: unknown) {
    const parsed = ApplyTagSchema.parse(body);
    const tags = await this.tags.addToTicket(ticketId, parsed.tagId);
    return { tags };
  }

  @Delete('tickets/:ticketId/tags/:tagId')
  async removeFromTicket(
    @Param('ticketId') ticketId: string,
    @Param('tagId') tagId: string,
  ) {
    const tags = await this.tags.removeFromTicket(ticketId, tagId);
    return { tags };
  }

  @Post('clients/:clientId/tags/bulk-apply')
  async bulkApply(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = BulkApplySchema.parse(body);
    const result = await this.tags.bulkApplyToTickets(clientId, parsed.ticketIds, parsed.tagId);
    return result;
  }
}
