import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { TestCustomerService } from './test-customer.service';

const MarkTestCustomerSchema = z.object({
  channel: z.enum(['messenger', 'whatsapp', 'web']),
  externalSenderId: z.string().trim().min(1),
  note: z.string().trim().max(280).optional(),
  markedBy: z.string().trim().min(1).optional(),
});

@Controller()
export class TestCustomerController {
  constructor(private readonly tests: TestCustomerService) {}

  @Get('clients/:clientId/test-customers')
  async list(@Param('clientId') clientId: string) {
    const testCustomers = await this.tests.list(clientId);
    return { testCustomers };
  }

  @Post('clients/:clientId/test-customers')
  async mark(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = MarkTestCustomerSchema.parse(body);
    const testCustomer = await this.tests.mark({
      clientId,
      channel: parsed.channel,
      externalSenderId: parsed.externalSenderId,
      note: parsed.note,
      markedBy: parsed.markedBy ?? 'internal-console',
    });
    return { testCustomer };
  }

  @Delete('clients/:clientId/test-customers/:markId')
  async unmark(@Param('clientId') clientId: string, @Param('markId') markId: string) {
    await this.tests.unmark(clientId, markId);
    return { ok: true };
  }
}
