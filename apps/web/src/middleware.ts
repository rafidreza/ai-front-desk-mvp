import { NextRequest, NextResponse } from 'next/server';
import { hasInternalSession } from '@/lib/internal-auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPath = pathname === '/internal/login';
  const isBackendProxy = pathname.startsWith('/api/backend');
  const isAuthenticated = await hasInternalSession(request);

  if (isLoginPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/internal', request.url));
  }

  if (isBackendProxy && !isAuthenticated) {
    return NextResponse.json({ error: 'Internal session required.' }, { status: 401 });
  }

  if (!isLoginPath && !isBackendProxy && !isAuthenticated) {
    const loginUrl = new URL('/internal/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/internal/:path*', '/api/backend/:path*'],
};
