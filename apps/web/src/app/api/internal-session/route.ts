import { NextRequest, NextResponse } from 'next/server';
import { getInternalSession } from '@/lib/internal-auth';

export async function GET(request: NextRequest) {
  const session = await getInternalSession(request);
  if (session === null) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: session.userId,
      label: session.label,
      email: session.email,
      role: session.role,
    },
  });
}
