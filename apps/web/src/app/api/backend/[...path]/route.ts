import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { getInternalSession, InternalSessionRole } from '@/lib/internal-auth';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
}

function isLocalApiBaseUrl(apiBaseUrl: string) {
  const hostname = new URL(apiBaseUrl).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getApiToken() {
  const apiBaseUrl = getApiBaseUrl();
  const token = process.env.INTERNAL_API_TOKEN;
  if (process.env.NODE_ENV === 'production' && (token === undefined || token.length < 32) && !isLocalApiBaseUrl(apiBaseUrl)) {
    throw new Error('INTERNAL_API_TOKEN must be set to at least 32 characters in production.');
  }
  return token ?? 'dev-internal-api-token-only-for-local-work';
}

function isAdminOnlyMutation(path: string) {
  return (
    path === '/clients' ||
    /^\/clients\/[^/]+(?:\/status|\/channels(?:\/[^/]+(?:\/delete)?)?|\/digests\/[^/]+\/send)/.test(path) ||
    /^\/clients\/[^/]+\/(?:prompts|auto-replies|whatsapp\/templates|industry-templates)(?:\/|$)/.test(path) ||
    /^\/internal\/users(?:\/|$)/.test(path)
  );
}

function canMutate(role: InternalSessionRole, path: string) {
  if (role === 'admin') return true;
  if (role === 'read-only') return false;
  return !isAdminOnlyMutation(path);
}

function getClientIdFromPath(path: string) {
  return path.match(/^\/clients\/([^/]+)/)?.[1];
}

function describeMutation(method: string, path: string) {
  const segments = path.split('/').filter(Boolean);
  const fallback = {
    action: method.toLowerCase(),
    entityType: segments[0] ?? 'unknown',
    entityId: segments.at(-1),
    summary: `${method} ${path}`,
  };

  if (/^\/tickets\/[^/]+\/status$/.test(path) || /^\/clients\/[^/]+\/tickets\/[^/]+\/status$/.test(path)) {
    return { ...fallback, action: 'ticket.status_changed', entityType: 'ticket', entityId: segments.at(-2), summary: 'Changed ticket status' };
  }
  if (/^\/tickets\/[^/]+\/assignee$/.test(path)) {
    return { ...fallback, action: 'ticket.assignee_changed', entityType: 'ticket', entityId: segments.at(-2), summary: 'Changed ticket assignee' };
  }
  if (/^\/tickets\/[^/]+\/comments$/.test(path)) {
    return { ...fallback, action: 'ticket.comment_added', entityType: 'ticket', entityId: segments.at(-2), summary: 'Added internal ticket note' };
  }
  if (/^\/clients\/[^/]+\/knowledge(?:\/|$)/.test(path)) {
    const action = path.includes('/rollback')
      ? 'knowledge.rollback'
      : path.includes('/status')
        ? 'knowledge.status_changed'
        : path.includes('/review')
          ? 'knowledge.reviewed'
          : method === 'PATCH'
            ? 'knowledge.updated'
            : 'knowledge.changed';
    return { ...fallback, action, entityType: 'knowledge', entityId: segments.at(-1), summary: 'Changed knowledge base entry' };
  }
  if (/^\/internal\/knowledge-requests(?:\/|$)/.test(path)) {
    return { ...fallback, action: 'knowledge_request.reviewed', entityType: 'knowledge_request', entityId: segments[2], summary: 'Reviewed knowledge change request' };
  }
  if (/^\/clients\/[^/]+\/prompts(?:\/|$)/.test(path)) {
    return { ...fallback, action: 'prompt.changed', entityType: 'prompt_profile', entityId: segments.at(-1), summary: 'Changed prompt profile' };
  }
  if (/^\/clients\/[^/]+\/channels(?:\/|$)/.test(path)) {
    return { ...fallback, action: path.endsWith('/delete') ? 'channel.deleted' : 'channel.changed', entityType: 'client_channel', entityId: segments.at(-1), summary: 'Changed client channel setup' };
  }
  if (/^\/clients\/[^/]+\/auto-replies(?:\/|$)/.test(path)) {
    return { ...fallback, action: method === 'DELETE' ? 'auto_reply.deleted' : 'auto_reply.changed', entityType: 'auto_reply', entityId: segments.at(-1), summary: 'Changed auto-reply rule' };
  }
  if (/^\/clients\/[^/]+\/whatsapp\/templates(?:\/|$)/.test(path)) {
    return { ...fallback, action: method === 'DELETE' ? 'legacy_template.deleted' : 'legacy_template.changed', entityType: 'legacy_template', entityId: segments.at(-1), summary: 'Changed retired channel template' };
  }
  if (/^\/clients\/[^/]+\/tags(?:\/|$)/.test(path) || /^\/tickets\/[^/]+\/tags(?:\/|$)/.test(path)) {
    return { ...fallback, action: method === 'DELETE' ? 'tag.deleted' : 'tag.changed', entityType: 'tag', entityId: segments.at(-1), summary: 'Changed ticket tags' };
  }
  if (/^\/internal\/users(?:\/|$)/.test(path)) {
    return { ...fallback, action: 'internal_user.changed', entityType: 'internal_user', entityId: segments.at(-1), summary: 'Changed internal user access' };
  }
  if (/^\/conversations\/[^/]+(?:\/|$)/.test(path)) {
    return { ...fallback, action: 'conversation.changed', entityType: 'conversation', entityId: segments[1], summary: 'Changed conversation record' };
  }
  if (/^\/clients\/[^/]+(?:\/status)?$/.test(path)) {
    return { ...fallback, action: 'client.changed', entityType: 'client', entityId: segments[1], summary: 'Changed client profile' };
  }
  return fallback;
}

async function recordAudit(input: {
  apiPath: string;
  method: string;
  status: number;
  requestBody: string | undefined;
  actorId: string;
  actorRole: string;
}) {
  if (input.apiPath === '/internal/audit-log') return;
  const details = describeMutation(input.method, input.apiPath);
  const clientId = getClientIdFromPath(input.apiPath);

  await fetch(new URL('/internal/audit-log', getApiBaseUrl()), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiToken()}`,
    },
    body: JSON.stringify({
      clientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: details.action,
      entityType: details.entityType,
      entityId: details.entityId,
      summary: details.summary,
      metadata: {
        method: input.method,
        path: input.apiPath,
        status: input.status,
        requestBodyLength: input.requestBody?.length ?? 0,
      },
    }),
  }).catch(() => undefined);
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const apiPath = `/${path.join('/')}`;
  const internalSession = await getInternalSession(request);
  const clientSession = internalSession === null ? await getClientSession(request) : null;
  const isMutation = request.method !== 'GET' && request.method !== 'HEAD';

  if (internalSession !== null && isMutation && !canMutate(internalSession.role, apiPath)) {
    return NextResponse.json(
      { error: `${internalSession.role} cannot perform this action.` },
      { status: 403 },
    );
  }

  const targetUrl = new URL(apiPath, getApiBaseUrl());
  targetUrl.search = request.nextUrl.search;
  const requestBody = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
      Authorization: `Bearer ${getApiToken()}`,
      ...(internalSession === null
        ? {}
        : {
            'x-internal-user-id': internalSession.userId,
            'x-internal-user-role': internalSession.role,
          }),
    },
    body: requestBody,
    cache: 'no-store',
  });

  const responseBody = await response.text();
  if (isMutation && response.ok) {
    await recordAudit({
      apiPath,
      method: request.method,
      status: response.status,
      requestBody,
      actorId: internalSession?.userId ?? (clientSession === null ? 'unknown' : `client:${clientSession.clientId}`),
      actorRole: internalSession?.role ?? (clientSession === null ? 'unknown' : 'client'),
    });
  }
  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
