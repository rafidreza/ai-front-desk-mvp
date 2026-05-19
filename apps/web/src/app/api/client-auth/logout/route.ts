import { NextRequest, NextResponse } from 'next/server';
import { clientSessionCookieName } from '@/lib/client-auth';
import { shouldUseSecureCookie } from '@/lib/cookies';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: clientSessionCookieName,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: 0,
  });
  return response;
}
