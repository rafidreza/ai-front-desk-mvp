import { describe, expect, it, vi } from 'vitest';
import type { AppDb } from '../src/db/client';
import { clientChannels, clients, metaOAuthSessions } from '../src/db/schema';
import { buildMetaOAuthUrl, MetaOAuthService } from '../src/services/meta-oauth';

const env = {
  NODE_ENV: 'development',
  META_APP_ID: '2238102173658208',
  META_APP_SECRET: 'test-meta-secret-do-not-log',
  META_OAUTH_REDIRECT_URI: 'https://dev.daemion.io/api/meta/callback',
  META_OAUTH_SCOPES: 'pages_show_list,pages_manage_metadata,pages_messaging',
  MESSENGER_GRAPH_VERSION: 'v20.0',
};

function createFakeDb() {
  const state = {
    client: {
      id: 'client-1',
      businessName: 'Demo Seller',
      pageId: 'client-1-page-pending',
      ownerName: null,
      ownerEmail: 'owner@example.com',
      ownerPhone: null,
      businessCategory: null,
      onboardingStatus: 'channels_complete',
      onboardingProfile: null,
      complianceProfile: null,
      lifecycleStage: 'onboarding',
      conversionChecklist: null,
      defaultLanguage: 'mixed',
      tone: 'friendly',
      escalationKeywords: [],
      whatsappPoc: null,
      digestEmail: 'owner@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: undefined as Record<string, unknown> | undefined,
    channel: undefined as Record<string, unknown> | undefined,
  };

  const db = {
    select(fields?: Record<string, unknown>) {
      return {
        from(table: unknown) {
          return {
            where() {
              return {
                limit() {
                  if (table === clients) return Promise.resolve(fields === undefined ? [state.client] : []);
                  if (table === metaOAuthSessions) return Promise.resolve(state.session === undefined ? [] : [state.session]);
                  if (table === clientChannels) return Promise.resolve(state.channel === undefined ? [] : [state.channel]);
                  return Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          if (table === metaOAuthSessions) state.session = values;
          if (table === clientChannels) {
            state.channel = values;
            return {
              onConflictDoUpdate(input: { set: Record<string, unknown> }) {
                state.channel = { ...state.channel, ...input.set };
                return Promise.resolve();
              },
            };
          }
          return Promise.resolve();
        },
      };
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          return {
            where() {
              if (table === clients) state.client = { ...state.client, ...values };
              if (table === metaOAuthSessions) state.session = { ...state.session, ...values };
              return Promise.resolve();
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where() {
          if (table === clientChannels) state.channel = undefined;
          return Promise.resolve();
        },
      };
    },
  };

  return { db: db as unknown as AppDb, state };
}

describe('Meta OAuth flow', () => {
  it('generates a Meta OAuth URL with app id, redirect URI, scopes, and signed state', async () => {
    const url = new URL(await buildMetaOAuthUrl({ env, stateId: 'state-1', stateSignature: 'sig-1' }));

    expect(url.origin).toBe('https://www.facebook.com');
    expect(url.pathname).toBe('/v20.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('2238102173658208');
    expect(url.searchParams.get('redirect_uri')).toBe('https://dev.daemion.io/api/meta/callback');
    expect(url.searchParams.get('scope')).toBe('pages_show_list,pages_manage_metadata,pages_messaging');
    expect(url.searchParams.get('state')).toBe('state-1.sig-1');
  });

  it('handles callback pages without storing raw Page tokens, then selects a Page connection', async () => {
    const { db, state } = createFakeDb();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/oauth/access_token')) {
        return Response.json({ access_token: 'user-token' });
      }
      if (url.pathname.endsWith('/me/accounts')) {
        return Response.json({
          data: [
            { id: 'page-1', name: 'Demo Page', access_token: 'page-token-secret' },
            { id: 'page-2', name: 'Backup Page', access_token: 'backup-page-token-secret' },
          ],
        });
      }
      return Response.json({ error: { message: 'unexpected' } }, { status: 500 });
    });
    const service = new MetaOAuthService(db, env, fetchMock as unknown as typeof fetch);

    const start = await service.start({ clientId: 'client-1', returnTo: '/client/dashboard?clientId=client-1' });
    const callbackUrl = new URL(start.authorizationUrl);
    const stateParam = callbackUrl.searchParams.get('state');
    expect(stateParam).toBeTruthy();

    const callback = await service.handleCallback({ state: stateParam!, code: 'code-from-meta' });
    expect(callback).toMatchObject({ clientId: 'client-1', status: 'pages_ready' });
    expect(JSON.stringify(state.session)).not.toContain('page-token-secret');

    const pending = await service.getSessionForClient({ clientId: 'client-1', sessionId: callback.sessionId });
    expect(pending.pages).toEqual([
      { id: 'page-1', name: 'Demo Page' },
      { id: 'page-2', name: 'Backup Page' },
    ]);

    const selected = await service.selectPage({ clientId: 'client-1', sessionId: callback.sessionId, pageId: 'page-1' });
    expect(selected.page).toEqual({ id: 'page-1', name: 'Demo Page' });
    expect(state.client.pageId).toBe('page-1');
    expect(state.channel?.externalId).toBe('page-1');
    expect(JSON.stringify(state.channel)).not.toContain('page-token-secret');

    const token = await service.getConnectedPageAccessToken({ clientId: 'client-1', pageId: 'page-1' });
    expect(token).toBe('page-token-secret');
  });

  it('disconnects the saved Messenger Page and returns the client to setup-needed state', async () => {
    const { db, state } = createFakeDb();
    state.client.pageId = 'page-1';
    state.channel = {
      id: 'client-1:messenger:page-1',
      clientId: 'client-1',
      channel: 'messenger',
      externalId: 'page-1',
      label: 'Demo Page',
      status: 'connected',
      isPrimary: true,
      metadata: { pageAccessTokenEncrypted: 'encrypted-token' },
    };
    const service = new MetaOAuthService(db, env);

    await expect(service.disconnectPage({ clientId: 'client-1' })).resolves.toMatchObject({
      disconnected: true,
      pageId: 'page-1',
    });
    expect(state.channel).toBeUndefined();
    expect(state.client.pageId).toBe('client-1-page-pending');
  });
});
