import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function proxy(request: NextRequest) {
  // Supabase appends the OAuth `?code` (or a provider `?error`) to the Site URL
  // *root* when the requested redirect_to is not in the Redirect URLs allow
  // list. The marketing homepage can't exchange it, so the user would silently
  // land there unauthenticated. Forward it to the real callback instead.
  const isOauthLanding =
    request.nextUrl.pathname === '/' &&
    (request.nextUrl.searchParams.has('code') || request.nextUrl.searchParams.has('error'));
  if (isOauthLanding) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
