import { NextRequest, NextResponse } from 'next/server';
import { shouldUseSecureCookie } from '@/lib/cookies';
import { internalSessionCookieName } from '@/lib/internal-auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: internalSessionCookieName,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: shouldUseSecureCookie(request),
    path: '/',
    maxAge: 0,
  });

  return response;
}
