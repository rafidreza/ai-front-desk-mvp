import { NextRequest, NextResponse } from 'next/server';
import { clientSessionCookieName, createClientSessionCookie } from '@/lib/client-auth';
import { backendFetch } from '@/lib/server-backend';
import { ClientProfile } from '@/types/domain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await backendFetch<{ client: ClientProfile }>('/clients/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const response = NextResponse.json(data);
    response.cookies.set({
      name: clientSessionCookieName,
      value: await createClientSessionCookie(data.client.id),
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create workspace.' },
      { status: 400 },
    );
  }
}
