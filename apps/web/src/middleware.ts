import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { hasInternalSession } from '@/lib/internal-auth';

function getBackendClientId(pathname: string) {
  const match = pathname.match(/^\/api\/backend\/clients\/([^/]+)(?:\/|$)/);
  return match?.[1];
}

function isClientAllowedBackendPath(pathname: string) {
  return (
    /^\/api\/backend\/clients\/[^/]+\/dashboard$/.test(pathname) ||
    /^\/api\/backend\/clients\/[^/]+\/tickets(?:\/[^/]+\/status)?$/.test(pathname) ||
    /^\/api\/backend\/clients\/[^/]+\/conversations\/[^/]+\/csat$/.test(pathname) ||
    /^\/api\/backend\/clients\/[^/]+\/knowledge\/client-view$/.test(pathname) ||
    /^\/api\/backend\/clients\/[^/]+\/knowledge\/requests(?:\/[^/]+)?$/.test(pathname) ||
    /^\/api\/backend\/clients\/[^/]+\/knowledge\/[^/]+\/requests$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPath = pathname === '/internal/login';
  const isClientLoginPath = pathname === '/client/login';
  const isClientPath = pathname.startsWith('/client/') && !isClientLoginPath;
  const isBackendProxy = pathname.startsWith('/api/backend');
  const isAuthenticated = await hasInternalSession(request);
  const clientSession = await getClientSession(request);

  if (isLoginPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/internal', request.url));
  }

  if (isClientLoginPath && clientSession !== null) {
    const dashboardUrl = new URL('/client/dashboard', request.url);
    dashboardUrl.searchParams.set('clientId', clientSession.clientId);
    return NextResponse.redirect(dashboardUrl);
  }

  if (isClientPath && clientSession === null) {
    const loginUrl = new URL('/client/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isClientPath && clientSession !== null) {
    const requestedClientId = request.nextUrl.searchParams.get('clientId');
    if (requestedClientId === null) {
      const clientUrl = new URL(request.url);
      clientUrl.searchParams.set('clientId', clientSession.clientId);
      return NextResponse.redirect(clientUrl);
    }
    if (requestedClientId !== clientSession.clientId) {
      const clientUrl = new URL(request.url);
      clientUrl.searchParams.set('clientId', clientSession.clientId);
      return NextResponse.redirect(clientUrl);
    }
  }

  if (isBackendProxy && !isAuthenticated) {
    const backendClientId = getBackendClientId(pathname);
    if (backendClientId !== undefined && clientSession?.clientId === backendClientId && isClientAllowedBackendPath(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: 'Internal session required.' }, { status: 401 });
  }

  if (!isLoginPath && !isClientLoginPath && !isClientPath && !isBackendProxy && !isAuthenticated) {
    const loginUrl = new URL('/internal/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/internal/:path*', '/client/:path*', '/api/backend/:path*'],
};
