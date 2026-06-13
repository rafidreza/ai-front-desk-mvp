import { NextRequest, NextResponse } from 'next/server';

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
}

export function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state');
  if (state === null || state.trim() === '') {
    const failureUrl = new URL('/client/meta/select', request.url);
    failureUrl.searchParams.set('status', 'failed');
    failureUrl.searchParams.set(
      'message',
      'Meta did not return a valid connection session. Start the Facebook Page connection again from your dashboard.',
    );
    return NextResponse.redirect(failureUrl);
  }

  const callbackUrl = new URL('/oauth/meta/callback', getApiBaseUrl());
  callbackUrl.search = request.nextUrl.search;
  return NextResponse.redirect(callbackUrl);
}
