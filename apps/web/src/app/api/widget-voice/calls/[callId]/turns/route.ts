import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendFetch } from '@/lib/server-backend';

type RouteContext = {
  params: Promise<{ callId: string }>;
};

const PersistTurnSchema = z.object({
  clientId: z.string().trim().min(1),
  turnIndex: z.number().int().min(0),
  speaker: z.enum(['caller', 'ai', 'human']),
  text: z.string().trim().min(1),
  language: z.string().trim().max(16).optional(),
  latencyMs: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { callId } = await context.params;
  try {
    const input = PersistTurnSchema.parse(await request.json());
    const response = await backendFetch(`/voice/calls/${encodeURIComponent(callId)}/turns`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to save this voice transcript turn.' },
      { status: 502 },
    );
  }
}
