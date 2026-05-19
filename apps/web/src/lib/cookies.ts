import { NextRequest } from 'next/server';

export function shouldUseSecureCookie(request: NextRequest) {
  const protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return process.env.NODE_ENV === 'production' && protocol === 'https';
}
