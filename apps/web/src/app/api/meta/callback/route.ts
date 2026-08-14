import { NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
  const retiredUrl = new URL('/client/meta/select', request.url);
  retiredUrl.searchParams.set('status', 'retired');
  return NextResponse.redirect(retiredUrl);
}
