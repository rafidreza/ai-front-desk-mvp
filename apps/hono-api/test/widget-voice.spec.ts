import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppBindings, AppDb } from '../src/db/client';
import { normalizeError } from '../src/errors';
import { authMiddleware } from '../src/middleware/security';
import { widgetVoiceRoutes } from '../src/routes/widget-voice';
import {
  WidgetVoiceConsentError,
  WidgetVoiceDisabledError,
  WidgetVoiceService,
  signWidgetVoiceToken,
  verifyWidgetVoiceToken,
  type ClientLookup,
  type WidgetVoiceConfig,
} from '../src/services/widget-voice';

const SECRET = 'test-widget-voice-secret-at-least-32-chars-long';

function config(overrides: Partial<WidgetVoiceConfig> = {}): WidgetVoiceConfig {
  return {
    enabled: true,
    secret: SECRET,
    runtimeUrl: 'http://localhost:7860',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    tokenTtlS: 120,
    maxDurationS: 300,
    ...overrides,
  };
}

const knownClient: ClientLookup = { get: async (clientId) => ({ id: clientId }) };
const noClient: ClientLookup = { get: async () => null };

describe('widget voice token', () => {
  it('round-trips a payload through sign + verify', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const token = await signWidgetVoiceToken(SECRET, {
      clientId: 'client-1',
      visitorId: 'visitor-1',
      issuedAt: expiresAt - 60,
      expiresAt,
      maxDurationS: 300,
      nonce: 'nonce-1',
    });
    const payload = await verifyWidgetVoiceToken(SECRET, token);
    expect(payload?.clientId).toBe('client-1');
    expect(payload?.visitorId).toBe('visitor-1');
    expect(payload?.maxDurationS).toBe(300);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signWidgetVoiceToken('another-secret-entirely-but-long-enough!', {
      clientId: 'client-1',
      visitorId: 'visitor-1',
      issuedAt: 0,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      maxDurationS: 300,
      nonce: 'n',
    });
    expect(await verifyWidgetVoiceToken(SECRET, token)).toBeNull();
  });

  it('rejects a tampered clientId — the payload is signed, not just encoded', async () => {
    const token = await signWidgetVoiceToken(SECRET, {
      clientId: 'client-1',
      visitorId: 'visitor-1',
      issuedAt: 0,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      maxDurationS: 300,
      nonce: 'n',
    });
    const [version, body, signature] = token.split('.') as [string, string, string];
    const forged = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '=')), (ch) =>
          ch.charCodeAt(0),
        ),
      ),
    );
    forged.clientId = 'victim-client';
    const forgedBody = btoa(JSON.stringify(forged)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await verifyWidgetVoiceToken(SECRET, `${version}.${forgedBody}.${signature}`)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const issuedAt = 1_000;
    const token = await signWidgetVoiceToken(SECRET, {
      clientId: 'client-1',
      visitorId: 'visitor-1',
      issuedAt,
      expiresAt: issuedAt + 60,
      maxDurationS: 300,
      nonce: 'n',
    });
    expect(await verifyWidgetVoiceToken(SECRET, token, issuedAt + 30)).not.toBeNull();
    expect(await verifyWidgetVoiceToken(SECRET, token, issuedAt + 61)).toBeNull();
  });

  it('rejects malformed tokens and unknown versions', async () => {
    expect(await verifyWidgetVoiceToken(SECRET, 'garbage')).toBeNull();
    expect(await verifyWidgetVoiceToken(SECRET, 'a.b')).toBeNull();
    const token = await signWidgetVoiceToken(SECRET, {
      clientId: 'client-1',
      visitorId: 'v',
      issuedAt: 0,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      maxDurationS: 300,
      nonce: 'n',
    });
    const [, body, signature] = token.split('.') as [string, string, string];
    expect(await verifyWidgetVoiceToken(SECRET, `v2.${body}.${signature}`)).toBeNull();
  });
});

describe('WidgetVoiceService.createSession', () => {
  it('grants a token scoped to the requested tenant', async () => {
    const service = new WidgetVoiceService(config(), knownClient);
    const grant = await service.createSession({ clientId: 'client-1', visitorId: 'visitor-1', consent: true });
    expect(grant).not.toBeNull();
    expect(grant!.maxDurationS).toBe(300);
    expect(grant!.voiceRuntimeUrl).toBe('http://localhost:7860');
    const payload = await verifyWidgetVoiceToken(SECRET, grant!.sessionToken);
    expect(payload?.clientId).toBe('client-1');
  });

  it('returns null for an unknown tenant (404 upstream, no enumeration signal)', async () => {
    const service = new WidgetVoiceService(config(), noClient);
    expect(await service.createSession({ clientId: 'nope', visitorId: 'v', consent: true })).toBeNull();
  });

  it('refuses without explicit consent', async () => {
    const service = new WidgetVoiceService(config(), knownClient);
    await expect(service.createSession({ clientId: 'client-1', visitorId: 'v', consent: false })).rejects.toThrow(
      WidgetVoiceConsentError,
    );
  });

  it('refuses when the feature is switched off', async () => {
    const service = new WidgetVoiceService(config({ enabled: false }), knownClient);
    await expect(service.createSession({ clientId: 'client-1', visitorId: 'v', consent: true })).rejects.toThrow(
      WidgetVoiceDisabledError,
    );
  });

  it('issues a distinct token per call so two sessions never collide', async () => {
    const service = new WidgetVoiceService(config(), knownClient);
    const first = await service.createSession({ clientId: 'client-1', visitorId: 'v', consent: true });
    const second = await service.createSession({ clientId: 'client-1', visitorId: 'v', consent: true });
    expect(first!.sessionToken).not.toBe(second!.sessionToken);
  });
});

/**
 * Route-level checks. The one that matters most is the first: the widget runs in an anonymous
 * browser, so this endpoint must work with NO Authorization header while the rest of the API
 * still refuses. A regression in publicPrefixes would break every widget call in the field.
 */
describe('POST /widget-voice/session', () => {
  const env = {
    NODE_ENV: 'development',
    INTERNAL_API_TOKEN: 'x'.repeat(40),
    WIDGET_VOICE_TOKEN_SECRET: SECRET,
    VOICE_RUNTIME_URL: 'http://voice-runtime.test',
    WEBRTC_ICE_SERVERS: '[{"urls":"stun:stun.l.google.com:19302"}]',
  };
  const executionCtx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

  function appWithClient(rows: unknown[]) {
    const chain = { from: () => chain, where: () => chain, limit: async () => rows };
    const app = new Hono<AppBindings>();
    // Same error normalisation createApp() installs — without it a ZodError surfaces as 500.
    app.onError((error, c) => {
      const normalized = normalizeError(error);
      return c.json(normalized.body, normalized.status as 400 | 404 | 500);
    });
    app.use('*', authMiddleware);
    app.use('*', async (c, next) => {
      c.set('db', { select: () => chain } as unknown as AppDb);
      await next();
    });
    app.route('/', widgetVoiceRoutes());
    return app;
  }

  function post(app: ReturnType<typeof appWithClient>, body: unknown, headers: Record<string, string> = {}) {
    return app.fetch(
      new Request('http://api.test/widget-voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }),
      env,
      executionCtx,
    );
  }

  it('is public — an anonymous browser with no bearer token can mint a session', async () => {
    const app = appWithClient([{ id: 'pilot-client', name: 'Pilot' }]);
    const response = await post(app, { clientId: 'pilot-client', visitorId: 'v-1', consent: true });
    expect(response.status).toBe(200);

    const grant = (await response.json()) as {
      sessionToken: string;
      voiceRuntimeUrl: string;
      maxDurationS: number;
      iceServers: unknown[];
    };
    expect(grant.voiceRuntimeUrl).toBe('http://voice-runtime.test');
    expect(grant.iceServers).toHaveLength(1);
    expect(grant.maxDurationS).toBe(300);

    // The token the browser receives really does name the tenant the runtime will trust.
    const payload = await verifyWidgetVoiceToken(SECRET, grant.sessionToken);
    expect(payload?.clientId).toBe('pilot-client');
  });

  it('404s for an unknown tenant', async () => {
    const app = appWithClient([]);
    const response = await post(app, { clientId: 'nope', visitorId: 'v', consent: true });
    expect(response.status).toBe(404);
  });

  it('400s without consent', async () => {
    const app = appWithClient([{ id: 'pilot-client' }]);
    const response = await post(app, { clientId: 'pilot-client', visitorId: 'v', consent: false });
    expect(response.status).toBe(400);
  });

  it('400s on a malformed body', async () => {
    const app = appWithClient([{ id: 'pilot-client' }]);
    const response = await post(app, { visitorId: 'v', consent: true });
    expect(response.status).toBe(400);
  });
});
