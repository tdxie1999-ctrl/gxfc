import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromMiddleware } from '@/lib/supabase/middleware';

const protectedRoutes = ['/lobby', '/club', '/hall', '/room', '/lottery', '/profile'];
const authRoutes = ['/login', '/register'];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 管理后台使用单独校验逻辑，这里直接放行
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const { session, response } = await getSessionFromMiddleware(request);
  const isGuest = request.cookies.get('guest_mode')?.value === '1';

  if (isProtectedRoute(pathname) && !session && !isGuest) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (authRoutes.includes(pathname) && session) {
    const lobbyUrl = request.nextUrl.clone();
    lobbyUrl.pathname = '/lobby';
    return NextResponse.redirect(lobbyUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|assets).*)'],
};
