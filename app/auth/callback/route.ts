import { NextResponse } from 'next/server';
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server';
import { hasCompletedOnboarding } from '@/app/auth/onboarding-status';
import { safeNextPath } from '@/lib/safe-next';
import { bootstrapOAuthUser } from '@/app/auth/user-bootstrap';
import { ONBOARDING_PENDING_COOKIE, onboardingPendingCookie } from '@/lib/onboarding-cookie';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Sanitized post-auth redirect target: same-origin relative path only, so a
  // crafted ?next= can never bounce a freshly signed-in user off-site.
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Validate the OAuth session (an email address is required to finish
      // onboarding later). The local user row is created only when every
      // profile detail has been supplied - see completeOnboarding.
      const bootstrapped = await bootstrapOAuthUser(user!);
      if (!bootstrapped.ok) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error`);
      }

      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      const completed = await hasCompletedOnboarding(user!.id);
      let destination = next;
      if (next === '/') {
        // New users (no username yet) land on onboarding; everyone else on the dashboard.
        destination = completed ? '/dashboard' : '/onboarding';
      }
      // Flag unfinished sessions BEFORE they land on /onboarding so the
      // middleware exempts them from the homepage -> dashboard auto-jump
      // (otherwise every exit from the form loops back into it).
      const url = isLocalEnv
        ? `${origin}${destination}`
        : forwardedHost
          ? `https://${forwardedHost}${destination}`
          : `${origin}${destination}`;
      const response = NextResponse.redirect(url);
      if (completed) {
        response.cookies.delete(ONBOARDING_PENDING_COOKIE);
      } else {
        response.cookies.set(ONBOARDING_PENDING_COOKIE, '1', onboardingPendingCookie);
      }
      // we can be sure that there is no load balancer in local dev, so no need
      // to watch for X-Forwarded-Host
      return response;
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
