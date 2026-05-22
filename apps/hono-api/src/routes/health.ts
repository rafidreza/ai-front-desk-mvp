import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import type { AppBindings } from '../db/client';

export function healthRoutes() {
  const app = new Hono<AppBindings>();

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      service: 'ai-front-desk-api',
      phase: 'phase-0-messenger-spike',
      timestamp: new Date().toISOString(),
    }),
  );

  app.get('/health/db', async (c) => {
    const startedAt = Date.now();
    const db = c.get('db');
    if (db === undefined) {
      return c.json({
        status: 'degraded',
        service: 'ai-front-desk-api',
        database: { enabled: false, ok: false, error: 'DATABASE_URL is not configured.' },
        timestamp: new Date().toISOString(),
      });
    }
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({
        status: 'ok',
        service: 'ai-front-desk-api',
        database: { enabled: true, ok: true, latencyMs: Date.now() - startedAt },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return c.json({
        status: 'degraded',
        service: 'ai-front-desk-api',
        database: {
          enabled: true,
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : 'Unknown database error.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  return app;
}
