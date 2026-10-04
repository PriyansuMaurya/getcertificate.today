// "Signed in, but still owes onboarding" flag.
//
// Written by the auth server actions/route handlers (app/auth/*), read by
// utils/supabase/middleware.ts. Without it every exit from /onboarding loops:
// the homepage auto-jumps signed-in users to /dashboard, whose layout bounces
// non-onboarded users straight back to /onboarding.
//
// Keep this module free of next/headers (and any server-only import) so the
// proxy/middleware bundle can safely import the constants.

export const ONBOARDING_PENDING_COOKIE = 'onboarding_pending';

// Generous window - the flag only exists to keep navigation unlocked while
// the form is unfinished; it self-heals (middleware stamps the user again on
// the next /onboarding visit) if it ever expires mid-flow.
export const ONBOARDING_PENDING_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const onboardingPendingCookie: {
  path: string;
  sameSite: 'lax';
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
} = {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: ONBOARDING_PENDING_MAX_AGE,
};
