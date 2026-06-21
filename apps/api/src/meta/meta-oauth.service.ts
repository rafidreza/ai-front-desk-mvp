import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { decryptSecret, encryptSecret, randomMetaOAuthId, signState, timingSafeStringEqual } from './meta-oauth.crypto';

const defaultMetaScopes = ['pages_show_list', 'pages_manage_metadata', 'pages_messaging'];
const stateTtlMs = 20 * 60 * 1000;

type StoredMetaPage = {
  id: string;
  name: string;
  pageAccessTokenEncrypted: string;
};

type MetaTokenResponse = {
  access_token?: string;
  error?: { message?: string };
};

type MetaPagesResponse = {
  data?: Array<{ id?: string; name?: string; access_token?: string }>;
  error?: { message?: string };
};

function graphVersion() {
  return process.env.MESSENGER_GRAPH_VERSION ?? 'v25.0';
}

function appId() {
  const value = process.env.META_APP_ID;
  if (value === undefined || value === '') throw new Error('META_APP_ID is required for Meta OAuth.');
  return value;
}

function appSecret() {
  const value = process.env.META_APP_SECRET?.trim() || process.env.MESSENGER_APP_SECRET?.trim();
  if (value === undefined || value === '') throw new Error('META_APP_SECRET or MESSENGER_APP_SECRET is required for Meta OAuth.');
  return value;
}

function redirectUri() {
  return process.env.META_OAUTH_REDIRECT_URI ?? `${(process.env.WEB_APP_URL ?? 'http://localhost:3002').split(',')[0]}/api/meta/callback`;
}

function oauthScopes() {
  return (process.env.META_OAUTH_SCOPES ?? defaultMetaScopes.join(','))
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function sanitizeReturnTo(returnTo?: string) {
  if (returnTo === undefined || returnTo.trim() === '') return undefined;
  if (!returnTo.startsWith('/client/')) return undefined;
  return returnTo.slice(0, 300);
}

function assertValidPages(pages: Prisma.JsonValue | null): StoredMetaPage[] {
  if (!Array.isArray(pages)) return [];
  return pages.filter((page): page is StoredMetaPage => {
    if (typeof page !== 'object' || page === null || Array.isArray(page)) return false;
    const record = page as Record<string, unknown>;
    return typeof record.id === 'string' && typeof record.name === 'string' && typeof record.pageAccessTokenEncrypted === 'string';
  });
}

function metadataWithToken(encrypted: string): Prisma.InputJsonObject {
  return {
    provider: 'meta',
    pageAccessTokenEncrypted: encrypted,
    graphVersion: graphVersion(),
    scopes: oauthScopes(),
  };
}

@Injectable()
export class MetaOAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async start(input: { clientId: string; returnTo?: string }) {
    const client = await this.prisma.client.findUnique({ where: { id: input.clientId } });
    if (client === null) throw new NotFoundException(`Client not found: ${input.clientId}`);

    const stateId = randomMetaOAuthId();
    const now = new Date();
    await this.prisma.metaOAuthSession.create({
      data: {
        id: stateId,
        clientId: input.clientId,
        status: 'started',
        returnTo: sanitizeReturnTo(input.returnTo),
        expiresAt: new Date(now.getTime() + stateTtlMs),
      },
    });

    const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
    url.searchParams.set('client_id', appId());
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('state', `${stateId}.${signState(appSecret(), stateId)}`);
    url.searchParams.set('scope', oauthScopes().join(','));
    url.searchParams.set('response_type', 'code');
    return {
      authorizationUrl: url.toString(),
      expiresAt: new Date(now.getTime() + stateTtlMs).toISOString(),
    };
  }

  async handleCallback(input: { state: string; code?: string; error?: string; errorDescription?: string }) {
    const [stateId, signature] = input.state.split('.');
    if (stateId === undefined || signature === undefined || !timingSafeStringEqual(signature, signState(appSecret(), stateId))) {
      throw new BadRequestException('Invalid Meta OAuth state.');
    }

    const session = await this.prisma.metaOAuthSession.findUnique({ where: { id: stateId } });
    if (session === null || session.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Meta OAuth session is invalid or expired.');
    }

    if (input.error !== undefined) {
      await this.prisma.metaOAuthSession.update({
        where: { id: stateId },
        data: { status: 'failed', error: input.errorDescription ?? input.error },
      });
      return { clientId: session.clientId, sessionId: stateId, status: 'failed' as const, returnTo: session.returnTo ?? undefined };
    }

    if (input.code === undefined || input.code.trim() === '') throw new BadRequestException('Meta OAuth code is required.');
    const userAccessToken = await this.exchangeCode(input.code);
    const pages = await this.fetchPages(userAccessToken);
    const encryptedPages = await Promise.all(
      pages.map(async (page) => ({
        id: page.id,
        name: page.name,
        pageAccessTokenEncrypted: await encryptSecret(appSecret(), page.pageAccessToken),
      })),
    );

    await this.prisma.metaOAuthSession.update({
      where: { id: stateId },
      data: {
        status: encryptedPages.length === 0 ? 'no_pages' : 'pages_ready',
        pages: encryptedPages,
        error: encryptedPages.length === 0 ? 'No Facebook Pages were returned by Meta for this login.' : undefined,
      },
    });

    return {
      clientId: session.clientId,
      sessionId: stateId,
      status: encryptedPages.length === 0 ? ('no_pages' as const) : ('pages_ready' as const),
      returnTo: session.returnTo ?? undefined,
    };
  }

  async getSessionForClient(input: { clientId: string; sessionId: string }) {
    const session = await this.prisma.metaOAuthSession.findFirst({
      where: { id: input.sessionId, clientId: input.clientId },
    });
    if (session === null) throw new NotFoundException('Meta OAuth session not found.');
    const pages = assertValidPages(session.pages).map(({ id, name }) => ({ id, name }));
    return {
      id: session.id,
      status: session.status,
      error: session.error ?? undefined,
      pages,
      selectedPageId: session.selectedPageId ?? undefined,
      expiresAt: session.expiresAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
    };
  }

  async selectPage(input: { clientId: string; sessionId: string; pageId: string }) {
    const session = await this.prisma.metaOAuthSession.findFirst({
      where: { id: input.sessionId, clientId: input.clientId },
    });
    if (session === null) throw new NotFoundException('Meta OAuth session not found.');
    if (session.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Meta OAuth session expired. Please reconnect.');
    const selected = assertValidPages(session.pages).find((page) => page.id === input.pageId);
    if (selected === undefined) throw new BadRequestException('Selected Facebook Page was not returned by Meta.');

    const otherClient = await this.prisma.client.findFirst({
      where: { pageId: selected.id, id: { not: input.clientId } },
      select: { id: true },
    });
    if (otherClient !== null) throw new ConflictException('This Facebook Page is already connected to another Daemion workspace.');

    const otherChannel = await this.prisma.clientChannel.findFirst({
      where: { channel: 'messenger', externalId: selected.id, clientId: { not: input.clientId } },
      select: { clientId: true },
    });
    if (otherChannel !== null) throw new ConflictException('This Facebook Page is already connected to another Daemion workspace.');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.clientChannel.upsert({
        where: { channel_externalId: { channel: 'messenger', externalId: selected.id } },
        update: {
          clientId: input.clientId,
          label: selected.name,
          status: 'connected',
          isPrimary: true,
          metadata: metadataWithToken(selected.pageAccessTokenEncrypted),
          updatedAt: now,
        },
        create: {
          id: `${input.clientId}:messenger:${selected.id}`,
          clientId: input.clientId,
          channel: 'messenger',
          externalId: selected.id,
          label: selected.name,
          status: 'connected',
          isPrimary: true,
          metadata: metadataWithToken(selected.pageAccessTokenEncrypted),
          connectedAt: now,
        },
      });
      await tx.client.update({ where: { id: input.clientId }, data: { pageId: selected.id } });
      await tx.metaOAuthSession.update({
        where: { id: input.sessionId },
        data: { status: 'completed', selectedPageId: selected.id, completedAt: now },
      });
    });

    await this.subscribePage(selected.id, await decryptSecret(appSecret(), selected.pageAccessTokenEncrypted));
    return { page: { id: selected.id, name: selected.name } };
  }

  async getConnectedPageAccessToken(input: { clientId: string; pageId: string }) {
    const channel = await this.prisma.clientChannel.findFirst({
      where: { clientId: input.clientId, channel: 'messenger', externalId: input.pageId },
      select: { metadata: true },
    });
    const metadata = channel?.metadata;
    if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const encrypted = (metadata as Record<string, unknown>).pageAccessTokenEncrypted;
    if (typeof encrypted !== 'string') return undefined;
    return decryptSecret(appSecret(), encrypted);
  }

  async disconnectPage(input: { clientId: string }) {
    const client = await this.prisma.client.findUnique({ where: { id: input.clientId } });
    if (client === null) throw new NotFoundException(`Client not found: ${input.clientId}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.clientChannel.deleteMany({ where: { clientId: input.clientId, channel: 'messenger' } });
      await tx.client.update({ where: { id: input.clientId }, data: { pageId: `${input.clientId}-page-pending` } });
    });
    return { disconnected: true, pageId: client.pageId };
  }

  private async exchangeCode(code: string) {
    const url = new URL(`https://graph.facebook.com/${graphVersion()}/oauth/access_token`);
    url.searchParams.set('client_id', appId());
    url.searchParams.set('client_secret', appSecret());
    url.searchParams.set('redirect_uri', redirectUri());
    url.searchParams.set('code', code);
    const response = await fetch(url);
    const data = (await response.json()) as MetaTokenResponse;
    if (!response.ok || data.access_token === undefined) {
      throw new Error(`Meta OAuth token exchange failed: ${data.error?.message ?? response.status}`);
    }
    return data.access_token;
  }

  private async fetchPages(userAccessToken: string) {
    const url = new URL(`https://graph.facebook.com/${graphVersion()}/me/accounts`);
    url.searchParams.set('fields', 'id,name,access_token');
    url.searchParams.set('access_token', userAccessToken);
    const response = await fetch(url);
    const data = (await response.json()) as MetaPagesResponse;
    if (!response.ok) throw new Error(`Meta Page list failed: ${data.error?.message ?? response.status}`);
    return (data.data ?? [])
      .filter((page): page is { id: string; name: string; access_token: string } =>
        typeof page.id === 'string' && typeof page.name === 'string' && typeof page.access_token === 'string',
      )
      .map((page) => ({ id: page.id, name: page.name, pageAccessToken: page.access_token }));
  }

  private async subscribePage(pageId: string, pageAccessToken: string) {
    const url = new URL(`https://graph.facebook.com/${graphVersion()}/${pageId}/subscribed_apps`);
    url.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
    url.searchParams.set('access_token', pageAccessToken);
    const response = await fetch(url, { method: 'POST' });
    const data = (await response.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null;
    if (!response.ok || data?.success !== true) {
      throw new Error(`Meta Page subscription failed: ${data?.error?.message ?? response.status}`);
    }
  }
}
