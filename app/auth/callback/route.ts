import { NextResponse } from 'next/server';
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server';
import { hasCompletedOnboarding } from '@/app/auth/actions';
import { bootstrapOAuthUser } from '@/app/auth/user-bootstrap';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Create the local user row (Stripe customer + DB record) when this is
      // the user's first sign-in through any OAuth provider.
      const bootstrapped = await bootstrapOAuthUser(user!);
      if (!bootstrapped.ok) {
        return NextResponse.redirect(`${origin}/auth/auth-code-error`);
      }

      const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development';
      let destination = next;
      if (next === '/') {
        // New users (no username yet) land on onboarding; everyone else on the dashboard.
        const completed = await hasCompletedOnboarding(user!.id);
        destination = completed ? '/dashboard' : '/onboarding';
      }
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${destination}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${destination}`);
      } else {
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
