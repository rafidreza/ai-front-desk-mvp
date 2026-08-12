import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for the widget's voice-session mint.
 *
 * Mirrors api/web-chat/messages: the widget talks to its own origin, and this hop forwards to the
 * Hono API. That keeps the API base URL out of the browser bundle and avoids a CORS preflight on
 * the call-start path.
 *
 * Nothing secret passes through here — the response is a short-lived, tenant-scoped session token
 * the browser is meant to hold. See apps/hono-api/src/routes/widget-voice.ts.
 */

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
}

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(new URL('/widget-voice/session', getApiBaseUrl()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
      cache: 'no-store',
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to start a voice call.' },
      { status: 502 },
    );
  }
}
