import { and, eq, ne } from 'drizzle-orm';
import type { AppDb } from '../db/client';
import { clientChannels, clients, metaOAuthSessions } from '../db/schema';
import { envString, type Env } from '../env';
import { BadRequestError, ConflictError, NotFoundError } from '../errors';
import { hmacSha256Hex, randomId, timingSafeStringEqual } from '../utils/crypto';
import { decryptSecret, encryptSecret } from '../utils/encryption';

const defaultMetaScopes = ['pages_show_list', 'pages_manage_metadata', 'pages_messaging'];
const stateTtlMs = 20 * 60 * 1000;

export type MetaPageOption = {
  id: string;
  name: string;
};

type StoredMetaPage = MetaPageOption & {
  pageAccessTokenEncrypted: string;
};

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string };
};

type MetaPagesResponse = {
  data?: Array<{ id?: string; name?: string; access_token?: string }>;
  error?: { message?: string };
};

function graphVersion(env: Env) {
  return envString(env, 'MESSENGER_GRAPH_VERSION', 'v20.0') ?? 'v20.0';
}

function appId(env: Env) {
  const value = envString(env, 'META_APP_ID');
  if (value === undefined) throw new Error('META_APP_ID is required for Meta OAuth.');
  return value;
}

function appSecret(env: Env) {
  const value = envString(env, 'META_APP_SECRET');
  if (value === undefined) throw new Error('META_APP_SECRET is required for Meta OAuth.');
  return value;
}

function redirectUri(env: Env) {
  const value = envString(env, 'META_OAUTH_REDIRECT_URI', 'https://dev.daemion.io/api/meta/callback');
  if (value === undefined) throw new Error('META_OAUTH_REDIRECT_URI is required for Meta OAuth.');
  return value;
}

function oauthScopes(env: Env) {
  return (envString(env, 'META_OAUTH_SCOPES') ?? defaultMetaScopes.join(','))
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function sanitizeReturnTo(returnTo?: string) {
  if (returnTo === undefined || returnTo.trim() === '') return undefined;
  if (!returnTo.startsWith('/client/')) return undefined;
  return returnTo.slice(0, 300);
}

function assertValidPages(pages: unknown): StoredMetaPage[] {
  if (!Array.isArray(pages)) return [];
  return pages.filter((page): page is StoredMetaPage => {
    if (typeof page !== 'object' || page === null) return false;
    const record = page as Record<string, unknown>;
    return typeof record.id === 'string' && typeof record.name === 'string' && typeof record.pageAccessTokenEncrypted === 'string';
  });
}

async function signState(env: Env, stateId: string) {
  return hmacSha256Hex(appSecret(env), stateId);
}

export async function buildMetaOAuthUrl(input: {
  env: Env;
  stateId: string;
  stateSignature: string;
}) {
  const version = graphVersion(input.env);
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set('client_id', appId(input.env));
  url.searchParams.set('redirect_uri', redirectUri(input.env));
  url.searchParams.set('state', `${input.stateId}.${input.stateSignature}`);
  url.searchParams.set('scope', oauthScopes(input.env).join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('display', 'popup');
  return url.toString();
}

export class MetaOAuthService {
  constructor(
    private readonly db: AppDb,
    private readonly env: Env,
    private readonly fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  async start(input: { clientId: string; returnTo?: string }) {
    const [client] = await this.db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
    if (client === undefined) throw new NotFoundError(`Client not found: ${input.clientId}`);

    const stateId = randomId('meta-oauth-');
    const now = new Date();
    await this.db.insert(metaOAuthSessions).values({
      id: stateId,
      clientId: input.clientId,
      status: 'started',
      returnTo: sanitizeReturnTo(input.returnTo),
      expiresAt: new Date(now.getTime() + stateTtlMs),
      createdAt: now,
      updatedAt: now,
    });

    return {
      authorizationUrl: await buildMetaOAuthUrl({
        env: this.env,
        stateId,
        stateSignature: await signState(this.env, stateId),
      }),
      expiresAt: new Date(now.getTime() + stateTtlMs).toISOString(),
    };
  }

  async handleCallback(input: { state: string; code?: string; error?: string; errorDescription?: string }) {
    const [stateId, signature] = input.state.split('.');
    if (stateId === undefined || signature === undefined || !timingSafeStringEqual(signature, await signState(this.env, stateId))) {
      throw new BadRequestError('Invalid Meta OAuth state.');
    }

    const [session] = await this.db.select().from(metaOAuthSessions).where(eq(metaOAuthSessions.id, stateId)).limit(1);
    if (session === undefined || session.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestError('Meta OAuth session is invalid or expired.');
    }

    if (input.error !== undefined) {
      await this.db
        .update(metaOAuthSessions)
        .set({
          status: 'failed',
          error: input.errorDescription ?? input.error,
          updatedAt: new Date(),
        })
        .where(eq(metaOAuthSessions.id, stateId));
      return { clientId: session.clientId, sessionId: stateId, status: 'failed' as const, returnTo: session.returnTo };
    }

    if (input.code === undefined || input.code.trim() === '') throw new BadRequestError('Meta OAuth code is required.');
    const userAccessToken = await this.exchangeCode(input.code);
    const pages = await this.fetchPages(userAccessToken);
    const encryptedPages = await Promise.all(
      pages.map(async (page) => ({
        id: page.id,
        name: page.name,
        pageAccessTokenEncrypted: await encryptSecret(appSecret(this.env), page.pageAccessToken),
      })),
    );

    await this.db
      .update(metaOAuthSessions)
      .set({
        status: encryptedPages.length === 0 ? 'no_pages' : 'pages_ready',
        pages: encryptedPages,
        error: encryptedPages.length === 0 ? 'No Facebook Pages were returned by Meta for this login.' : undefined,
        updatedAt: new Date(),
      })
      .where(eq(metaOAuthSessions.id, stateId));

    return { clientId: session.clientId, sessionId: stateId, status: encryptedPages.length === 0 ? 'no_pages' as const : 'pages_ready' as const, returnTo: session.returnTo };
  }

  async getSessionForClient(input: { clientId: string; sessionId: string }) {
    const [session] = await this.db
      .select()
      .from(metaOAuthSessions)
      .where(and(eq(metaOAuthSessions.id, input.sessionId), eq(metaOAuthSessions.clientId, input.clientId)))
      .limit(1);
    if (session === undefined) throw new NotFoundError('Meta OAuth session not found.');
    const pages = assertValidPages(session.pages).map(({ id, name }) => ({ id, name }));
    return {
      id: session.id,
      status: session.status,
      error: session.error,
      pages,
      selectedPageId: session.selectedPageId,
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
    };
  }

  async selectPage(input: { clientId: string; sessionId: string; pageId: string }) {
    const [session] = await this.db
      .select()
      .from(metaOAuthSessions)
      .where(and(eq(metaOAuthSessions.id, input.sessionId), eq(metaOAuthSessions.clientId, input.clientId)))
      .limit(1);
    if (session === undefined) throw new NotFoundError('Meta OAuth session not found.');
    if (session.expiresAt.getTime() <= Date.now()) throw new BadRequestError('Meta OAuth session expired. Please reconnect.');
    const pages = assertValidPages(session.pages);
    const selected = pages.find((page) => page.id === input.pageId);
    if (selected === undefined) throw new BadRequestError('Selected Facebook Page was not returned by Meta.');

    const [otherClient] = await this.db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.pageId, selected.id), ne(clients.id, input.clientId)))
      .limit(1);
    if (otherClient !== undefined) {
      throw new ConflictError('This Facebook Page is already connected to another Daemion workspace.');
    }

    const [otherChannel] = await this.db
      .select({ clientId: clientChannels.clientId })
      .from(clientChannels)
      .where(and(eq(clientChannels.channel, 'messenger'), eq(clientChannels.externalId, selected.id), ne(clientChannels.clientId, input.clientId)))
      .limit(1);
    if (otherChannel !== undefined) {
      throw new ConflictError('This Facebook Page is already connected to another Daemion workspace.');
    }

    const now = new Date();
    const existingConnectionId = `${input.clientId}:messenger:${selected.id}`;
    await this.db
      .insert(clientChannels)
      .values({
        id: existingConnectionId,
        clientId: input.clientId,
        channel: 'messenger',
        externalId: selected.id,
        label: selected.name,
        status: 'connected',
        isPrimary: true,
        metadata: {
          provider: 'meta',
          pageAccessTokenEncrypted: selected.pageAccessTokenEncrypted,
          graphVersion: graphVersion(this.env),
          scopes: oauthScopes(this.env),
        },
        connectedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [clientChannels.channel, clientChannels.externalId],
        set: {
          clientId: input.clientId,
          label: selected.name,
          status: 'connected',
          isPrimary: true,
          metadata: {
            provider: 'meta',
            pageAccessTokenEncrypted: selected.pageAccessTokenEncrypted,
            graphVersion: graphVersion(this.env),
            scopes: oauthScopes(this.env),
          },
          updatedAt: now,
        },
      });

    await this.db.update(clients).set({ pageId: selected.id, updatedAt: now }).where(eq(clients.id, input.clientId));
    await this.db
      .update(metaOAuthSessions)
      .set({ status: 'completed', selectedPageId: selected.id, completedAt: now, updatedAt: now })
      .where(eq(metaOAuthSessions.id, input.sessionId));

    return {
      page: { id: selected.id, name: selected.name },
    };
  }

  async getConnectedPageAccessToken(input: { clientId: string; pageId: string }) {
    const [channel] = await this.db
      .select({ metadata: clientChannels.metadata })
      .from(clientChannels)
      .where(and(eq(clientChannels.clientId, input.clientId), eq(clientChannels.channel, 'messenger'), eq(clientChannels.externalId, input.pageId)))
      .limit(1);
    const encrypted = channel?.metadata?.pageAccessTokenEncrypted;
    if (typeof encrypted !== 'string') return undefined;
    return decryptSecret(appSecret(this.env), encrypted);
  }

  async disconnectPage(input: { clientId: string }) {
    const [client] = await this.db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
    if (client === undefined) throw new NotFoundError(`Client not found: ${input.clientId}`);

    const now = new Date();
    await this.db.delete(clientChannels).where(and(eq(clientChannels.clientId, input.clientId), eq(clientChannels.channel, 'messenger')));
    await this.db
      .update(clients)
      .set({
        pageId: `${input.clientId}-page-pending`,
        updatedAt: now,
      })
      .where(eq(clients.id, input.clientId));

    return {
      disconnected: true,
      pageId: client.pageId,
    };
  }

  private async exchangeCode(code: string) {
    const url = new URL(`https://graph.facebook.com/${graphVersion(this.env)}/oauth/access_token`);
    url.searchParams.set('client_id', appId(this.env));
    url.searchParams.set('client_secret', appSecret(this.env));
    url.searchParams.set('redirect_uri', redirectUri(this.env));
    url.searchParams.set('code', code);
    const response = await this.fetchImpl(url);
    const data = (await response.json()) as MetaTokenResponse;
    if (!response.ok || data.access_token === undefined) {
      throw new Error(`Meta OAuth token exchange failed: ${data.error?.message ?? response.status}`);
    }
    return data.access_token;
  }

  private async fetchPages(userAccessToken: string) {
    const url = new URL(`https://graph.facebook.com/${graphVersion(this.env)}/me/accounts`);
    url.searchParams.set('fields', 'id,name,access_token');
    url.searchParams.set('access_token', userAccessToken);
    const response = await this.fetchImpl(url);
    const data = (await response.json()) as MetaPagesResponse;
    if (!response.ok || data.data === undefined) {
      throw new Error(`Meta Page fetch failed: ${data.error?.message ?? response.status}`);
    }
    return data.data
      .map((page) => ({
        id: page.id?.trim() ?? '',
        name: page.name?.trim() ?? '',
        pageAccessToken: page.access_token?.trim() ?? '',
      }))
      .filter((page) => page.id !== '' && page.name !== '' && page.pageAccessToken !== '');
  }
}
