import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { hmacSha256Hex } from '../src/utils/crypto';

const env = {
  NODE_ENV: 'development',
  WEB_APP_URL: 'http://localhost:3002',
  INTERNAL_API_TOKEN: 'x'.repeat(40),
  MESSENGER_VERIFY_TOKEN: 'messenger-verify-token',
  WHATSAPP_VERIFY_TOKEN: 'whatsapp-verify-token',
};

describe('Hono API mirror', () => {
  const app = createApp();

  it('serves the public health route without a database binding', async () => {
    const response = await app.request('/health', {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'ai-front-desk-api',
      phase: 'phase-0-messenger-spike',
    });
  });

  it('reports degraded database health when DATABASE_URL is missing', async () => {
    const response = await app.request('/health/db', {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'degraded',
      database: { enabled: false, ok: false },
    });
  });

  it('keeps protected Nest routes behind bearer auth', async () => {
    for (const path of ['/clients', '/conversations', '/tickets', '/internal/users', '/industry-templates', '/voice/resolve', '/voice/clients/abc/context']) {
      const response = await app.request(path, {}, env);
      expect(response.status, path).toBe(401);
    }
  });

  it('authenticates explicit dev internal users for the staging portal', async () => {
    const response = await app.request(
      '/internal/auth/login',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.INTERNAL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'admin@daemion.local',
          password: 'dev-internal-pass',
        }),
      },
      { ...env, NODE_ENV: 'production', ENABLE_DEV_INTERNAL_USERS: 'true' },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      user: {
        id: 'ops-admin',
        email: 'admin@daemion.local',
        role: 'admin',
      },
    });
  });

  it('rejects dev internal users when the staging flag is disabled in production', async () => {
    const response = await app.request(
      '/internal/auth/login',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.INTERNAL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: 'admin@daemion.local',
          password: 'dev-internal-pass',
        }),
      },
      { ...env, NODE_ENV: 'production', ENABLE_DEV_INTERNAL_USERS: 'false' },
    );

    expect(response.status).toBe(401);
  });

  it('keeps the web chat route public while validating its body', async () => {
    const response = await app.request(
      '/web-chat/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: 'visitor-1', text: '' }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it('requires PDPA consent for public web chat messages', async () => {
    const response = await app.request(
      '/web-chat/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'pilot-client',
          visitorId: 'visitor-1',
          text: 'hello',
          messageId: 'web-message-1',
        }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  it('returns Meta webhook verification challenges as text', async () => {
    const messenger = await app.request(
      '/webhooks/messenger?hub.mode=subscribe&hub.verify_token=messenger-verify-token&hub.challenge=m-123',
      {},
      env,
    );
    const whatsapp = await app.request(
      '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=whatsapp-verify-token&hub.challenge=w-123',
      {},
      env,
    );

    expect(messenger.status).toBe(200);
    expect(await messenger.text()).toBe('m-123');
    expect(whatsapp.status).toBe(200);
    expect(await whatsapp.text()).toBe('w-123');
  });

  it('redirects broken Meta OAuth callbacks back to the client portal', async () => {
    const response = await app.request('/oauth/meta/callback?error=access_denied', {}, env);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/client/meta/select');
    expect(response.headers.get('location')).toContain('status=failed');
  });

  it('enforces webhook signatures before database work when a secret is configured', async () => {
    const response = await app.request(
      '/webhooks/messenger',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object: 'page', entry: [] }),
      },
      { ...env, MESSENGER_APP_SECRET: 'test-secret' },
    );

    expect(response.status).toBe(401);
  });

  it('allows configured CORS origins and computes HMAC signatures with Worker crypto', async () => {
    const response = await app.request('/health', { headers: { Origin: 'http://localhost:3002' } }, env);
    const signature = await hmacSha256Hex('secret', '{}');

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3002');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
});
