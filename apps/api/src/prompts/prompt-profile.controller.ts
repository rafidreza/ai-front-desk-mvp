import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PromptProfileService } from './prompt-profile.service';

const PromptProfileSchema = z.object({
  name: z.string().trim().min(2),
  systemInstructions: z.string().trim().min(10),
  toneRules: z.string().trim().min(2),
  escalationRules: z.string().trim().min(2),
  forbiddenClaims: z.string().trim().min(2),
  fallbackBehavior: z.string().trim().min(2),
  actorId: z.string().trim().min(2).optional(),
});

const PromptPatchSchema = PromptProfileSchema.partial();

const StatusSchema = z.object({
  status: z.enum(['draft', 'active', 'archived']),
  actorId: z.string().trim().min(2).optional(),
});

const RollbackSchema = z.object({
  versionId: z.string().trim().min(2),
  actorId: z.string().trim().min(2).optional(),
});

@Controller('clients/:clientId/prompts')
export class PromptProfileController {
  constructor(private readonly prompts: PromptProfileService) {}

  @Get()
  async list(@Param('clientId') clientId: string, @Query('status') status?: string) {
    return { profiles: await this.prompts.list(clientId, status) };
  }

  @Post()
  async create(@Param('clientId') clientId: string, @Body() body: unknown) {
    const parsed = PromptProfileSchema.parse(body);
    return { profile: await this.prompts.createDraft({ clientId, ...parsed }) };
  }

  @Patch(':profileId')
  async update(@Param('clientId') clientId: string, @Param('profileId') profileId: string, @Body() body: unknown) {
    const parsed = PromptPatchSchema.parse(body);
    return { profile: await this.prompts.update(clientId, profileId, parsed) };
  }

  @Patch(':profileId/status')
  async setStatus(@Param('clientId') clientId: string, @Param('profileId') profileId: string, @Body() body: unknown) {
    const parsed = StatusSchema.parse(body);
    return { profile: await this.prompts.setStatus(clientId, profileId, parsed.status, parsed.actorId) };
  }

  @Get(':profileId/versions')
  async listVersions(@Param('clientId') clientId: string, @Param('profileId') profileId: string) {
    return { versions: await this.prompts.listVersions(clientId, profileId) };
  }

  @Post(':profileId/rollback')
  async rollback(@Param('clientId') clientId: string, @Param('profileId') profileId: string, @Body() body: unknown) {
    const parsed = RollbackSchema.parse(body);
    return {
      profile: await this.prompts.rollback({
        clientId,
        profileId,
        versionId: parsed.versionId,
        actorId: parsed.actorId,
      }),
    };
  }
}
