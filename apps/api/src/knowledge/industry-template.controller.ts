import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { IndustryTemplateService } from './industry-template.service';

const ApplyTemplateSchema = z.object({
  actorId: z.string().trim().min(2).optional(),
});

@Controller()
export class IndustryTemplateController {
  constructor(private readonly templates: IndustryTemplateService) {}

  @Get('industry-templates')
  list() {
    return { templates: this.templates.list() };
  }

  @Get('industry-templates/:key')
  detail(@Param('key') key: string) {
    return { template: this.templates.get(key) };
  }

  @Post('clients/:clientId/industry-templates/:key/apply')
  async apply(
    @Param('clientId') clientId: string,
    @Param('key') key: string,
    @Body() body: unknown,
  ) {
    const parsed = ApplyTemplateSchema.parse(body ?? {});
    const result = await this.templates.apply({
      clientId,
      templateKey: key,
      actorId: parsed.actorId,
    });
    return result;
  }
}
