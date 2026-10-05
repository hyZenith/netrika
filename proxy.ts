import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const DEFAULT_SECRET = 'netrika-tele-ophthalmology-jwt-secret-key-2026-secure-token';
const sessionSecret = process.env.SESSION_SECRET || DEFAULT_SECRET;
const key = new TextEncoder().encode(sessionSecret);

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('netrika_session')?.value;
  const { pathname } = request.nextUrl;

  // Clone headers so we can append user auth state downstream
  const requestHeaders = new Headers(request.headers);

  if (token) {
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (payload && (payload as any).user) {
        requestHeaders.set('x-user-id', (payload as any).user.id || '');
        requestHeaders.set('x-user-role', (payload as any).user.role || '');
      }
    } catch {
      // Token is invalid/expired - clear it
      const response = NextResponse.next();
      response.cookies.delete('netrika_session');
      return response;
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, images, videos
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|gif|png|svg|ico|mp4|webm)).*)',
  ],
};
