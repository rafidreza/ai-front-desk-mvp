import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { UnauthorizedError } from '../errors';
import { createServices } from '../services';
import { verifyInternalCredentials } from '../services/internal-users';
import { jsonBody } from './helpers';

const InternalLoginSchema = z.object({
  identifier: z.string().trim().min(2).max(120),
  password: z.string().min(1).max(200),
});

const CreateInternalUserSchema = z.object({
  label: z.string().trim().min(2).max(80),
  email: z.string().trim().email().optional().or(z.literal('')),
  role: z.enum(['admin', 'support', 'sales', 'qa', 'viewer']).default('support'),
});

export function internalRoutes() {
  const app = new Hono<AppBindings>();
  app.post('/internal/auth/login', async (c) => {
    const parsed = InternalLoginSchema.parse(await jsonBody(c));
    const user = verifyInternalCredentials(parsed, c.env);
    if (user === null) {
      throw new UnauthorizedError('Invalid user or password.');
    }
    return c.json({ user });
  });
  app.get('/internal/users', async (c) => c.json({ users: await createServices(c).internalUsers.listUsers() }));
  app.post('/internal/users', async (c) => {
    const parsed = CreateInternalUserSchema.parse(await jsonBody(c));
    return c.json({ user: await createServices(c).internalUsers.createUser(parsed) });
  });
  return app;
}
