import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
import type { OperatorIdentity } from '../services/operator-access';
import { jsonBody } from './helpers';

/**
 * Anchor console + onboarding routes (T10 / T12 backends, for the Next.js UI).
 *
 * Bearer-gated (global authMiddleware). Operator identity is read from `operatorId`/`role` query
 * params for now (the web console passes the logged-in operator); wiring these to the real
 * session is a follow-up. RBAC + tenant scoping are still enforced inside the services.
 */

function operatorFrom(c: Context<AppBindings>): OperatorIdentity {
  const id = c.req.query('operatorId') ?? 'ops-admin';
  const role = (c.req.query('role') ?? 'admin') as OperatorIdentity['role'];
  return { id, role };
}

const ApprovalSchema = z.object({ decision: z.enum(['approve', 'reject']) });
const VoiceConfigSchema = z.object({
  languagePosture: z.string().trim().max(32).optional(),
  greeting: z.string().trim().max(500).optional(),
  ttsVoice: z.string().trim().max(80).optional(),
  recordingConsent: z.boolean().optional(),
});
const IcpSchema = z.object({
  mode: z.enum(['all', 'any']).optional(),
  conditions: z.array(
    z.object({
      field: z.string().trim().min(1),
      op: z.enum(['exists', 'truthy', 'eq', 'neq', 'in']),
      value: z.unknown().optional(),
    }),
  ),
});
const NumberSchema = z.object({ e164Number: z.string().trim().min(3), label: z.string().trim().max(80).optional() });

export function consoleRoutes() {
  const app = new Hono<AppBindings>();

  // --- Anchor console (T10) --------------------------------------------------------------------
  app.get('/console/:clientId/queue', async (c) =>
    c.json({ queue: await createServices(c).anchorConsole.queue(operatorFrom(c), { clientId: c.req.param('clientId') }) }),
  );
  app.get('/console/:clientId/calls', async (c) => {
    const services = createServices(c);
    const ctx = { clientId: c.req.param('clientId') };
    await services.operatorAccess.assertAccess(operatorFrom(c), ctx.clientId);
    return c.json({ calls: await services.calls.list(ctx) });
  });
  app.get('/console/:clientId/calls/:callId', async (c) =>
    c.json({ detail: await createServices(c).anchorConsole.callDetail(operatorFrom(c), { clientId: c.req.param('clientId') }, c.req.param('callId')) }),
  );
  app.get('/console/:clientId/approvals', async (c) =>
    c.json({ approvals: await createServices(c).anchorConsole.pendingApprovals(operatorFrom(c), { clientId: c.req.param('clientId') }) }),
  );
  app.post('/console/:clientId/approvals/:actionId', async (c) => {
    const { decision } = ApprovalSchema.parse(await jsonBody(c));
    const outcome = await createServices(c).anchorConsole.decideApproval(operatorFrom(c), { clientId: c.req.param('clientId') }, { actionId: c.req.param('actionId'), decision });
    return c.json({ outcome });
  });
  app.post('/console/:clientId/escalations/:escalationId/take', async (c) =>
    c.json({ escalation: await createServices(c).anchorConsole.takeEscalation(operatorFrom(c), { clientId: c.req.param('clientId') }, c.req.param('escalationId')) }),
  );
  app.post('/console/:clientId/escalations/:escalationId/resolve', async (c) =>
    c.json({ escalation: await createServices(c).anchorConsole.resolveEscalation(operatorFrom(c), { clientId: c.req.param('clientId') }, c.req.param('escalationId')) }),
  );
  app.get('/console/:clientId/flagged', async (c) =>
    c.json({ flagged: await createServices(c).anchorConsole.flaggedCalls(operatorFrom(c), { clientId: c.req.param('clientId') }) }),
  );

  // --- Onboarding (T12) ------------------------------------------------------------------------
  app.get('/onboarding/:clientId/voice-config', async (c) =>
    c.json({ voiceConfig: await createServices(c).onboarding.getVoiceConfig({ clientId: c.req.param('clientId') }) }),
  );
  app.put('/onboarding/:clientId/voice-config', async (c) => {
    const config = VoiceConfigSchema.parse(await jsonBody(c));
    await createServices(c).onboarding.setVoiceConfig({ clientId: c.req.param('clientId') }, config);
    return c.json({ ok: true });
  });
  app.put('/onboarding/:clientId/icp', async (c) => {
    const config = IcpSchema.parse(await jsonBody(c));
    await createServices(c).onboarding.setIcpRules({ clientId: c.req.param('clientId') }, config);
    return c.json({ ok: true });
  });
  app.post('/onboarding/:clientId/numbers', async (c) => {
    const input = NumberSchema.parse(await jsonBody(c));
    const number = await createServices(c).onboarding.registerNumber({ clientId: c.req.param('clientId') }, input);
    return c.json({ number });
  });
  app.get('/onboarding/:clientId/readiness', async (c) =>
    c.json({ readiness: await createServices(c).onboarding.readiness({ clientId: c.req.param('clientId') }) }),
  );

  return app;
}
