import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/server-backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await backendFetch('/client-auth/request', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to request login code.' },
      { status: 400 },
    );
  }
}
