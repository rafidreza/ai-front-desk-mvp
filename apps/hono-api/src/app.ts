import { Hono } from 'hono';
import { captureSentryException } from '@ai-front-desk/shared';
import type { AppBindings } from './db/client';
import { dbMiddleware } from './db/client';
import { normalizeError } from './errors';
import { authMiddleware, bodyLimitMiddleware, corsMiddleware, rateLimitMiddleware } from './middleware/security';
import { channelRoutes } from './routes/channels';
import { clientRoutes } from './routes/clients';
import { conversationRoutes } from './routes/conversations';
import { healthRoutes } from './routes/health';
import { internalRoutes } from './routes/internal';
import { knowledgeRoutes } from './routes/knowledge';
import { promptRoutes } from './routes/prompts';

export function createApp() {
  const app = new Hono<AppBindings>();

  app.onError((error, c) => {
    const normalized = normalizeError(error);
    if (normalized.status >= 500) {
      c.executionCtx.waitUntil(
        captureSentryException(error, {
          dsn: c.env.SENTRY_DSN,
          environment: c.env.SENTRY_ENVIRONMENT ?? c.env.NODE_ENV,
          release: c.env.APP_VERSION,
          runtime: 'hono-api',
          request: {
            method: c.req.method,
            url: c.req.url,
          },
        }),
      );
    }
    return c.json(normalized.body, normalized.status as 400 | 401 | 404 | 409 | 429 | 500);
  });

  app.use('*', corsMiddleware());
  app.use('*', bodyLimitMiddleware);
  app.use('*', rateLimitMiddleware);
  app.use('*', authMiddleware);
  app.use('*', dbMiddleware);

  app.route('/', healthRoutes());
  app.route('/', channelRoutes());
  app.route('/', clientRoutes());
  app.route('/', conversationRoutes());
  app.route('/', internalRoutes());
  app.route('/', knowledgeRoutes());
  app.route('/', promptRoutes());

  app.notFound((c) => c.json({ statusCode: 404, message: 'Not Found' }, 404));

  return app;
}
