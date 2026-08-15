import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendFetch } from '@/lib/server-backend';

const StartTrackedCallSchema = z.object({
  clientId: z.string().trim().min(1),
  visitorId: z.string().trim().max(128).optional().nullable(),
  consent: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const input = StartTrackedCallSchema.parse(await request.json());
    const response = await backendFetch('/voice/sessions', {
      method: 'POST',
      body: JSON.stringify({
        clientId: input.clientId,
        callerIdMasked: input.visitorId === null || input.visitorId === undefined ? undefined : `web:${input.visitorId.slice(0, 60)}`,
        languagePosture: 'web-widget',
      }),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to track this voice call.' },
      { status: 502 },
    );
  }
}
