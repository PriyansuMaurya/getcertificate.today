import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ONBOARDING_PENDING_COOKIE } from '@/lib/onboarding-cookie';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();

  if (request.nextUrl.pathname.startsWith('/webhook')) {
    return supabaseResponse;
  }

  // Public, no-auth routes (FR-F1 verification, FR-E3 certificate sharing).
  // Kept as exact prefixes per RULES §9.5 - add new ones narrowly.
  // robots.txt and sitemap.xml are served by app/robots.ts and app/sitemap.ts;
  // redirecting them to /login would hide crawler directives from Google.
  const PUBLIC_PREFIXES = ['/verify', '/certificates', '/privacy', '/terms'];
  const CRAWLER_FILES = ['/robots.txt', '/sitemap.xml'];
  // Exact path or path segment match: '/certificates' stays public but
  // '/certificates-anything' (or a future '/verify-internal') does not silently
  // inherit public access from a bare prefix match.
  const isPublicPath =
    PUBLIC_PREFIXES.some(
      (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`)
    ) || CRAWLER_FILES.includes(request.nextUrl.pathname);

  if (
    !user &&
    !isPublicPath &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/forgot-password') &&
    !request.nextUrl.pathname.startsWith('/error') &&
    !(request.nextUrl.pathname === '/')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  // If user is logged in, redirect to dashboard - EXCEPT while they still
  // owe onboarding: /onboarding stamps that cookie, and without this
  // exemption every exit from the form would bounce
  // / -> /dashboard -> /onboarding in an inescapable loop.
  if (
    user &&
    request.nextUrl.pathname === '/' &&
    !request.cookies.get(ONBOARDING_PENDING_COOKIE)?.value
  ) {
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
