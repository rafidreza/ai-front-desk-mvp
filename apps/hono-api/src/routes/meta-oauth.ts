import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { envString } from '../env';
import { BadRequestError } from '../errors';
import { createServices } from '../services';
import { jsonBody } from './helpers';

const StartMetaOAuthSchema = z.object({
  returnTo: z.string().trim().optional(),
});

const SelectMetaPageSchema = z.object({
  pageId: z.string().trim().min(2),
});

function webAppUrl(env: AppBindings['Bindings']) {
  return envString(env, 'WEB_APP_URL', 'http://localhost:3002') ?? 'http://localhost:3002';
}

function callbackRedirect(env: AppBindings['Bindings'], input: { clientId?: string; sessionId?: string; status: string; message?: string }) {
  const url = new URL('/client/meta/select', webAppUrl(env).split(',')[0]);
  if (input.clientId !== undefined) url.searchParams.set('clientId', input.clientId);
  if (input.sessionId !== undefined) url.searchParams.set('sessionId', input.sessionId);
  url.searchParams.set('status', input.status);
  if (input.message !== undefined) url.searchParams.set('message', input.message);
  return url.toString();
}

export function metaOAuthRoutes() {
  const app = new Hono<AppBindings>();

  app.post('/clients/:clientId/meta/oauth/start', async (c) => {
    const parsed = StartMetaOAuthSchema.parse(await jsonBody(c));
    return c.json(await createServices(c).metaOAuth.start({
      clientId: c.req.param('clientId'),
      returnTo: parsed.returnTo,
    }));
  });

  app.get('/oauth/meta/callback', async (c) => {
    const state = c.req.query('state');
    if (state === undefined || state.trim() === '') throw new BadRequestError('Meta OAuth state is required.');

    const result = await createServices(c).metaOAuth.handleCallback({
      state,
      code: c.req.query('code'),
      error: c.req.query('error'),
      errorDescription: c.req.query('error_description'),
    });

    return c.redirect(callbackRedirect(c.env, {
      clientId: result.clientId,
      sessionId: result.sessionId,
      status: result.status,
      message: result.status === 'failed' ? 'Meta authorization was cancelled or failed.' : undefined,
    }));
  });

  app.get('/clients/:clientId/meta/oauth-sessions/:sessionId', async (c) =>
    c.json({
      session: await createServices(c).metaOAuth.getSessionForClient({
        clientId: c.req.param('clientId'),
        sessionId: c.req.param('sessionId'),
      }),
    }),
  );

  app.post('/clients/:clientId/meta/oauth-sessions/:sessionId/select', async (c) => {
    const parsed = SelectMetaPageSchema.parse(await jsonBody(c));
    return c.json({
      connection: await createServices(c).metaOAuth.selectPage({
        clientId: c.req.param('clientId'),
        sessionId: c.req.param('sessionId'),
        pageId: parsed.pageId,
      }),
    });
  });

  return app;
}
