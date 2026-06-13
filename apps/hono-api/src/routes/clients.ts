import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { createServices } from '../services';
import { dailyOrWeekly, jsonBody } from './helpers';

const SignupSchema = z.object({
  businessName: z.string().trim().min(2),
  pageId: z.string().trim().min(2).optional(),
  ownerName: z.string().trim().min(2).optional(),
  ownerEmail: z.string().trim().email().optional(),
  ownerPhone: z.string().trim().min(5).optional(),
  businessCategory: z.string().trim().min(2).optional(),
  defaultLanguage: z.enum(['bangla', 'english', 'mixed']).optional(),
  tone: z.string().trim().min(5).optional(),
  whatsappPoc: z.string().trim().min(5).optional(),
  digestEmail: z.string().trim().email().optional(),
});

const CsatSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

const OnboardingProfilePatchSchema = z.object({
  focusChannels: z.array(z.enum(['whatsapp', 'facebook', 'website'])).min(1).max(3).optional(),
  websiteUrl: z.string().trim().url().optional(),
  facebookPageUrl: z.string().trim().url().optional(),
  whatsappSetup: z.enum(['self', 'assisted', 'skip']).optional(),
  facebookSetup: z.enum(['oauth', 'assisted', 'skip']).optional(),
});

const OnboardingPatchSchema = z.object({
  businessCategory: z.string().trim().min(2).max(80).optional(),
  pageId: z.string().trim().min(2).max(180).optional(),
  whatsappPoc: z.string().trim().min(5).max(80).optional(),
  onboardingStatus: z.enum(['signup_started', 'profile_complete', 'channels_complete', 'onboarding_complete']).optional(),
  onboardingProfile: OnboardingProfilePatchSchema.optional(),
});

const TicketStatusSchema = z.object({
  status: z.enum(['open', 'assigned', 'waiting_client', 'resolved']),
  expectedVersion: z.number().int().nonnegative().optional(),
});

const RequestCodeSchema = z.object({
  identifier: z.string().trim().min(2),
  channel: z.enum(['email', 'whatsapp']).optional(),
});

const VerifyCodeSchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

export function clientRoutes() {
  const app = new Hono<AppBindings>();

  app.get('/clients', async (c) => c.json({ clients: await createServices(c).clients.list() }));

  app.post('/clients/signup', async (c) => {
    const parsed = SignupSchema.parse(await jsonBody(c));
    return c.json({ client: await createServices(c).clients.create(parsed) });
  });

  app.patch('/clients/:clientId/onboarding', async (c) => {
    const parsed = OnboardingPatchSchema.parse(await jsonBody(c));
    return c.json({ client: await createServices(c).clients.updateOnboarding(c.req.param('clientId'), parsed) });
  });

  app.post('/clients/:clientId/whatsapp/disconnect', async (c) =>
    c.json({ client: await createServices(c).clients.disconnectWhatsApp(c.req.param('clientId')) }),
  );

  app.get('/clients/:clientId/dashboard', async (c) => c.json(await createServices(c).dashboard.getDashboard(c.req.param('clientId'))));

  app.get('/clients/:clientId/digests/:cadence/preview', async (c) =>
    c.json(await createServices(c).dashboard.getDigestPreview(c.req.param('clientId'), dailyOrWeekly(c.req.param('cadence')))),
  );

  app.post('/clients/:clientId/digests/:cadence/send', async (c) => {
    const preview = await createServices(c).dashboard.getDigestPreview(c.req.param('clientId'), dailyOrWeekly(c.req.param('cadence')));
    return c.json({ digest: { ...preview, delivery: { mode: 'dry-run' } } });
  });

  app.patch('/clients/:clientId/conversations/:conversationId/csat', async (c) => {
    const parsed = CsatSchema.parse(await jsonBody(c));
    return c.json({
      conversation: await createServices(c).dashboard.captureCsat({
        clientId: c.req.param('clientId'),
        conversationId: c.req.param('conversationId'),
        score: parsed.score,
        comment: parsed.comment,
      }),
    });
  });

  app.get('/clients/:clientId/tickets', async (c) =>
    c.json({ tickets: await createServices(c).dashboard.listClientTickets(c.req.param('clientId'), c.req.query('status')) }),
  );

  app.get('/clients/:clientId/tickets/:ticketId', async (c) =>
    c.json(await createServices(c).dashboard.getClientTicketDetail(c.req.param('clientId'), c.req.param('ticketId'))),
  );

  app.patch('/clients/:clientId/tickets/:ticketId/status', async (c) => {
    const parsed = TicketStatusSchema.parse(await jsonBody(c));
    return c.json({
      ticket: await createServices(c).dashboard.updateClientTicketStatus({
        clientId: c.req.param('clientId'),
        ticketId: c.req.param('ticketId'),
        status: parsed.status,
        expectedVersion: parsed.expectedVersion,
      }),
    });
  });

  app.post('/client-auth/request', async (c) => {
    const parsed = RequestCodeSchema.parse(await jsonBody(c));
    return c.json({ challenge: await createServices(c).auth.requestCode(parsed) });
  });

  app.post('/client-auth/verify', async (c) => {
    const parsed = VerifyCodeSchema.parse(await jsonBody(c));
    return c.json({ client: await createServices(c).auth.verifyCode(parsed) });
  });

  return app;
}
