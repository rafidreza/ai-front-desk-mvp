import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
import { jsonBody } from './helpers';

const CreateInternalUserSchema = z.object({
  label: z.string().trim().min(2).max(80),
  email: z.string().trim().email().optional().or(z.literal('')),
  role: z.enum(['admin', 'support', 'sales', 'qa', 'viewer']).default('support'),
});

export function internalRoutes() {
  const app = new Hono<AppBindings>();
  app.get('/internal/users', async (c) => c.json({ users: await createServices(c).internalUsers.listUsers() }));
  app.post('/internal/users', async (c) => {
    const parsed = CreateInternalUserSchema.parse(await jsonBody(c));
    return c.json({ user: await createServices(c).internalUsers.createUser(parsed) });
  });
  return app;
}
