import { NextRequest, NextResponse } from 'next/server';

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

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = new URL(`/${path.join('/')}`, getApiBaseUrl());
  targetUrl.search = request.nextUrl.search;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
      Authorization: `Bearer ${getApiToken()}`,
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
