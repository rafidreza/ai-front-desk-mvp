import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
import { WidgetVoiceConsentError, WidgetVoiceDisabledError } from '../services/widget-voice';
import { jsonBody } from './helpers';

/**
 * Public voice-session mint for the web widget.
 *
 * PUBLIC on purpose — this is the one voice endpoint an anonymous visitor's browser may call, so
 * it is listed in `publicPrefixes` in middleware/security.ts and is NOT behind the internal bearer
 * token. Everything it hands back is scoped to a single call: a short-lived signed token, the
 * runtime URL, and ICE servers. It exposes no tenant data.
 *
 * Abuse controls, in order: rateLimitMiddleware (per IP + clientId) -> tenant must exist ->
 * explicit consent -> hard max call duration baked into the token. Add a Turnstile check here
 * before opening the widget to untrusted traffic at scale.
 */

const SessionSchema = z.object({
  clientId: z.string().trim().min(1).max(64),
  visitorId: z.string().trim().min(1).max(128),
  consent: z.boolean(),
});

export function widgetVoiceRoutes() {
  const app = new Hono<AppBindings>();

  app.post('/widget-voice/session', async (c) => {
    const input = SessionSchema.parse(await jsonBody(c));
    try {
      const grant = await createServices(c).widgetVoice.createSession(input);
      // Null means "no such tenant". Same shape as any other 404 — no enumeration signal.
      if (grant === null) return c.json({ message: 'Voice calling is not available here.' }, 404);
      return c.json(grant);
    } catch (error) {
      if (error instanceof WidgetVoiceDisabledError) return c.json({ message: error.message }, 503);
      if (error instanceof WidgetVoiceConsentError) return c.json({ message: error.message }, 400);
      throw error;
    }
  });

  return app;
}
