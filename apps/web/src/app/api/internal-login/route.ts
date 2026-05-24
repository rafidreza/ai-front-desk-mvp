import { NextRequest, NextResponse } from 'next/server';
import { shouldUseSecureCookie } from '@/lib/cookies';
import { createInternalSessionCookie, internalSessionCookieName } from '@/lib/internal-auth';
import { backendFetch } from '@/lib/server-backend';

const attempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 5;
const windowMs = 5 * 60 * 1000;

function getClientKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (current === undefined || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxAttempts;
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin === null) return true;

  const forwardedProtocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const allowedOrigins = new Set([
    request.nextUrl.origin,
    host === null ? undefined : `${forwardedProtocol}://${host}`,
    forwardedHost === null ? undefined : `${forwardedProtocol}://${forwardedHost}`,
    ...(process.env.WEB_APP_URL ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  ].filter((value): value is string => value !== undefined));

  if (allowedOrigins.has(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith('.trycloudflare.com') || hostname.endsWith('.loca.lt');
  }

  return false;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: 'Too many login attempts.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { identifier?: string; password?: string } | null;

  if (body?.identifier === undefined || body.password === undefined) {
    return NextResponse.json({ error: 'Email/id and password are required.' }, { status: 400 });
  }

  const auth = await backendFetch<{
    user: { id: string; label: string; email?: string; role: 'admin' | 'operator' | 'read-only' };
  }>('/internal/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: body.identifier.trim(),
      password: body.password,
    }),
  }).catch(() => null);

  if (auth === null) {
    return NextResponse.json({ error: 'Invalid user or password.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: internalSessionCookieName,
    value: await createInternalSessionCookie({
      userId: auth.user.id,
      label: auth.user.label,
      email: auth.user.email,
      role: auth.user.role,
    }),
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return response;
}
