import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { shouldUseSecureCookie } from '@/lib/cookies';
import { createInternalSessionCookie, internalSessionCookieName } from '@/lib/internal-auth';

const attempts = new Map<string, { count: number; resetAt: number }>();
const maxAttempts = 5;
const windowMs = 5 * 60 * 1000;

function getExpectedPassword() {
  const password = process.env.INTERNAL_CONSOLE_PASSWORD;
  if (process.env.NODE_ENV === 'production' && (password === undefined || password.length < 12)) {
    throw new Error('INTERNAL_CONSOLE_PASSWORD must be set to at least 12 characters in production.');
  }
  return password ?? 'dev-internal-pass';
}

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
  return origin === request.nextUrl.origin;
}

function passwordMatches(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: 'Too many login attempts.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const expectedPassword = getExpectedPassword();

  if (body?.password === undefined || !passwordMatches(body.password, expectedPassword)) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: internalSessionCookieName,
    value: await createInternalSessionCookie(),
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  return response;
}
