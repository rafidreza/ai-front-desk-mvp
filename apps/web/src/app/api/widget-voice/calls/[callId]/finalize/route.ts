import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendFetch } from '@/lib/server-backend';

type RouteContext = {
  params: Promise<{ callId: string }>;
};

const FinalizeTrackedCallSchema = z.object({
  clientId: z.string().trim().min(1),
  status: z.enum(['ended', 'failed']),
  endReason: z.string().trim().max(120).optional(),
  outcome: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { callId } = await context.params;
  try {
    const input = FinalizeTrackedCallSchema.parse(await request.json());
    const response = await backendFetch(`/voice/calls/${encodeURIComponent(callId)}/finalize`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to close this voice call.' },
      { status: 502 },
    );
  }
}
