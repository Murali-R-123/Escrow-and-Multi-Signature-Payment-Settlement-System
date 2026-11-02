import { NextResponse } from 'next/server';
import { COOKIE_NAME, verifyToken } from './lib/token';

// Page-level gate. API routes enforce auth themselves (requireUser) so they return JSON, not redirects.
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (!session && !isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (session && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && session?.role !== 'ADMIN') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/escrows/:path*', '/disputes/:path*', '/admin/:path*', '/login', '/register'],
};
