import { NextResponse } from 'next/server';
import { clientSessionCookieName } from '@/lib/client-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: clientSessionCookieName,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
