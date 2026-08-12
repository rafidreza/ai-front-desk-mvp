import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
// PARKED with the telco ingress routes below: import { CallRoutingError } from '../services/telephony';
import { jsonBody } from './helpers';

/**
 * Voice bridge (T2 integration).
 *
 * The HTTP surface the Python voice runtime (Pipecat) calls to plug into the tenant-safe backend:
 * open/close the Call record, persist transcript turns, and fetch the client's voice context (so
 * the agent grounds on the real per-client config, not a hardcoded prompt). All routes are gated
 * by the internal bearer token (see authMiddleware) — the runtime is a trusted server-side caller,
 * never the visitor's browser.
 *
 * TELCO PARKED (2026-07-28): the dialled-number ingress routes (`/voice/resolve`, `/voice/calls`)
 * are commented out below. They only serve PSTN/SIP inbound, which has no provider. The live
 * entry point is `/voice/sessions` (tenant already known), used by the web-widget WebRTC path.
 * Un-comment both routes when a telephony provider is signed — the services behind them
 * (`phoneNumbers.resolveClientByDialledNumber`, `calls.startInboundCall`) are untouched and
 * still tested.
 */

// -- PARKED: telco-only request schemas. Restore with the routes below. --
// const ResolveSchema = z.object({ dialledNumber: z.string().trim().min(3) });
// const StartCallSchema = z.object({
//   dialledNumber: z.string().trim().min(3),
//   callerIdMasked: z.string().trim().max(64).optional(),
//   languagePosture: z.string().trim().max(32).optional(),
// });
const TurnSchema = z.object({
  clientId: z.string().trim().min(1),
  turnIndex: z.number().int().min(0),
  speaker: z.enum(['caller', 'ai', 'human']),
  text: z.string(),
  language: z.string().trim().max(16).optional(),
  latencyMs: z.number().int().min(0).optional(),
});
const FinalizeSchema = z.object({
  clientId: z.string().trim().min(1),
  status: z.enum(['ended', 'failed']),
  endReason: z.string().trim().max(120).optional(),
  recordingUrl: z.string().trim().max(1024).optional(),
  outcome: z.string().trim().max(120).optional(),
});
const SessionSchema = z.object({
  clientId: z.string().trim().min(1),
  callerIdMasked: z.string().trim().max(64).optional(),
  languagePosture: z.string().trim().max(32).optional(),
});
const ThreadResolveSchema = z.object({ clientId: z.string().trim().min(1), identity: z.string().trim().min(1) });
const ThreadStateSchema = z.object({ clientId: z.string().trim().min(1), state: z.record(z.unknown()) });
const QualifySchema = z.object({
  clientId: z.string().trim().min(1),
  threadId: z.string().trim().min(1),
  callId: z.string().trim().optional(),
  fields: z.record(z.unknown()),
});
const EscalateSchema = z.object({
  clientId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(120),
  threadId: z.string().trim().optional(),
  mode: z.enum(['async', 'queued']).optional(),
  payload: z.record(z.unknown()).optional(),
});
const ScoreSchema = z.object({ clientId: z.string().trim().min(1) });

export function voiceRoutes() {
  const app = new Hono<AppBindings>();

  // -- PARKED: telco ingress (PSTN/SIP). No provider — see the file header. ------------------
  // // Resolve a dialled number to its owning client. 404 (no fallback tenant) when unmapped.
  // app.post('/voice/resolve', async (c) => {
  //   const { dialledNumber } = ResolveSchema.parse(await jsonBody(c));
  //   const resolved = await createServices(c).phoneNumbers.resolveClientByDialledNumber(dialledNumber);
  //   if (resolved === null) return c.json({ message: 'No client mapped to this number.' }, 404);
  //   return c.json(resolved);
  // });
  //
  // // Answer an inbound call: resolve tenant + create the Call record. 404 when unmapped.
  // app.post('/voice/calls', async (c) => {
  //   const input = StartCallSchema.parse(await jsonBody(c));
  //   try {
  //     const call = await createServices(c).calls.startInboundCall(input);
  //     return c.json({ call });
  //   } catch (error) {
  //     if (error instanceof CallRoutingError) return c.json({ message: error.message }, 404);
  //     throw error;
  //   }
  // });
  // -----------------------------------------------------------------------------------------

  // Start a call for an already-known client (browser/web-mic session; no dialled number).
  app.post('/voice/sessions', async (c) => {
    const { clientId, ...rest } = SessionSchema.parse(await jsonBody(c));
    const call = await createServices(c).calls.startSession({ clientId }, rest);
    return c.json({ call });
  });

  // Persist one transcript turn (idempotent by turn index), tenant-scoped by body clientId.
  app.post('/voice/calls/:callId/turns', async (c) => {
    const parsed = TurnSchema.parse(await jsonBody(c));
    const { clientId, ...turn } = parsed;
    const segment = await createServices(c).callPersistence.persistTurn(
      { clientId },
      { callId: c.req.param('callId'), ...turn },
    );
    return c.json({ segment });
  });

  // Close out a call.
  app.post('/voice/calls/:callId/finalize', async (c) => {
    const { clientId, ...rest } = FinalizeSchema.parse(await jsonBody(c));
    const call = await createServices(c).calls.finalize({ clientId }, c.req.param('callId'), rest);
    if (call === null) return c.json({ message: 'Call not found.' }, 404);
    return c.json({ call });
  });

  // The client's voice context (greeting, language posture, persona config) for the agent to use
  // instead of a hardcoded prompt. Tenant-scoped by path clientId.
  app.get('/voice/clients/:clientId/context', async (c) => {
    const ctx = { clientId: c.req.param('clientId') };
    const services = createServices(c);
    const [voiceConfig, icpRules] = await Promise.all([
      services.onboarding.getVoiceConfig(ctx),
      services.qualification.getRules(ctx),
    ]);
    return c.json({ voiceConfig, icpRules });
  });

  // The client's active knowledge base, for the agent to ground its answers on.
  app.get('/voice/clients/:clientId/knowledge', async (c) => {
    const entries = await createServices(c).knowledge.list(c.req.param('clientId'), 'active');
    return c.json({ entries });
  });

  // Load or create the caller's thread (by identity, e.g. phone number). Carries context across calls.
  app.post('/voice/threads/resolve', async (c) => {
    const { clientId, identity } = ThreadResolveSchema.parse(await jsonBody(c));
    const thread = await createServices(c).threadState.getOrCreateThread({ clientId }, identity);
    return c.json({ thread });
  });

  // Merge structured state onto a thread. `state` is a plain field map; values are wrapped server-side.
  app.post('/voice/threads/:threadId/state', async (c) => {
    const { clientId, state } = ThreadStateSchema.parse(await jsonBody(c));
    const patch = Object.fromEntries(Object.entries(state).map(([key, value]) => [key, { value }]));
    const fields = await createServices(c).threadState.applyStatePatch({ clientId }, c.req.param('threadId'), patch);
    return c.json({ fields });
  });

  // Qualify the caller against the client's ICP rules.
  app.post('/voice/calls/:callId/qualify', async (c) => {
    const { clientId, threadId, fields } = QualifySchema.parse(await jsonBody(c));
    const verdict = await createServices(c).qualification.qualify({ clientId }, { threadId, callId: c.req.param('callId'), fields });
    return c.json({ verdict });
  });

  // Escalate the call to a human anchor (lands in the tenant's console queue).
  app.post('/voice/calls/:callId/escalate', async (c) => {
    const { clientId, reason, threadId, mode, payload } = EscalateSchema.parse(await jsonBody(c));
    const escalation = await createServices(c).escalation.raise(
      { clientId },
      { reason, threadId, callId: c.req.param('callId'), mode, payload },
    );
    return c.json({ escalation });
  });

  // Score the completed call (post-call assurance).
  app.post('/voice/calls/:callId/score', async (c) => {
    const { clientId } = ScoreSchema.parse(await jsonBody(c));
    const score = await createServices(c).interactionScoring.scoreCall({ clientId }, c.req.param('callId'));
    return c.json({ score });
  });

  return app;
}
