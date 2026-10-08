// "This visitor arrived through a referral link" flag.
//
// Written by app/ref/[code]/route.ts when a valid referral URL is opened, read
// by app/auth/actions.ts (signup + completeOnboarding) and
// app/auth/callback/route.ts. Keeping it in a plain module (no next/headers,
// no server-only imports) mirrors lib/onboarding-cookie.ts so any server or
// route-handler bundle can import the constants.

export const REFERRAL_COOKIE = 'referral_code';

// Long enough to cover signup -> email confirmation -> onboarding, which can
// legitimately take days. The attribution is also mirrored into auth metadata
// at signup, so an expired cookie does not lose a genuine referral.
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const referralCookie: {
  path: string;
  sameSite: 'lax';
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
} = {
  path: '/',
  // 'lax' (not 'strict') so the cookie survives the top-level OAuth redirect
  // back from Google/GitHub into /auth/callback.
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: REFERRAL_COOKIE_MAX_AGE,
};
