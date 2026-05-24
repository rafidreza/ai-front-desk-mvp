import { NextRequest, NextResponse } from 'next/server';
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
    /^\/clients\/[^/]+(?:\/status|\/channels(?:\/[^/]+(?:\/delete)?)?|\/digests\/[^/]+\/send|\/external-data(?:\/|$))/.test(path) ||
    /^\/clients\/[^/]+\/(?:prompts|auto-replies|whatsapp\/templates|industry-templates)(?:\/|$)/.test(path) ||
    /^\/internal\/users(?:\/|$)/.test(path)
  );
}

function canMutate(role: InternalSessionRole, path: string) {
  if (role === 'admin') return true;
  if (role === 'read-only') return false;
  return !isAdminOnlyMutation(path);
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const apiPath = `/${path.join('/')}`;
  const internalSession = await getInternalSession(request);
  const isMutation = request.method !== 'GET' && request.method !== 'HEAD';

  if (internalSession !== null && isMutation && !canMutate(internalSession.role, apiPath)) {
    return NextResponse.json(
      { error: `${internalSession.role} cannot perform this action.` },
      { status: 403 },
    );
  }

  const targetUrl = new URL(apiPath, getApiBaseUrl());
  targetUrl.search = request.nextUrl.search;

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
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    cache: 'no-store',
  });

  const responseBody = await response.text();
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
