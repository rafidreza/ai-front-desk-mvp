import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
import { jsonBody } from './helpers';

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
const StatusSchema = z.object({ status: z.enum(['draft', 'active', 'archived']), actorId: z.string().trim().min(2).optional() });
const RollbackSchema = z.object({ versionId: z.string().trim().min(2), actorId: z.string().trim().min(2).optional() });

export function promptRoutes() {
  const app = new Hono<AppBindings>();

  app.get('/clients/:clientId/prompts', async (c) => c.json({ profiles: await createServices(c).prompts.list(c.req.param('clientId'), c.req.query('status')) }));
  app.post('/clients/:clientId/prompts', async (c) => {
    const parsed = PromptProfileSchema.parse(await jsonBody(c));
    return c.json({ profile: await createServices(c).prompts.createDraft({ clientId: c.req.param('clientId'), ...parsed }) });
  });
  app.patch('/clients/:clientId/prompts/:profileId', async (c) => {
    const parsed = PromptPatchSchema.parse(await jsonBody(c));
    return c.json({ profile: await createServices(c).prompts.update(c.req.param('clientId'), c.req.param('profileId'), parsed) });
  });
  app.patch('/clients/:clientId/prompts/:profileId/status', async (c) => {
    const parsed = StatusSchema.parse(await jsonBody(c));
    return c.json({ profile: await createServices(c).prompts.setStatus(c.req.param('clientId'), c.req.param('profileId'), parsed.status, parsed.actorId) });
  });
  app.get('/clients/:clientId/prompts/:profileId/versions', async (c) =>
    c.json({ versions: await createServices(c).prompts.listVersions(c.req.param('clientId'), c.req.param('profileId')) }),
  );
  app.post('/clients/:clientId/prompts/:profileId/rollback', async (c) => {
    const parsed = RollbackSchema.parse(await jsonBody(c));
    return c.json({ profile: await createServices(c).prompts.rollback({ clientId: c.req.param('clientId'), profileId: c.req.param('profileId'), versionId: parsed.versionId, actorId: parsed.actorId }) });
  });

  return app;
}
