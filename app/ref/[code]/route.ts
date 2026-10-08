import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { normalizeReferralCode } from '@/lib/referral-code';
import { REFERRAL_COOKIE, referralCookie } from '@/lib/referral-cookie';

// Public referral entry point: /ref/ABC123.
//
// Validates the code against the database (so a garbage link is never
// attributed) and stores it in an httpOnly cookie, then sends the visitor to
// signup. The cookie is what carries attribution through password signup and
// the Google/GitHub OAuth redirect; app/auth/actions.ts and
// app/auth/callback/route.ts copy it into auth metadata at account creation.
//
// Deliberately never reveals whether a code exists: both branches land on
// /signup, only the Set-Cookie header differs.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeReferralCode(rawCode);

  let valid = false;
  if (code) {
    try {
      const rows = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.referral_code, code));
      valid = rows.length > 0;
    } catch (err) {
      // A DB hiccup must never 500 a marketing link - fall through to plain
      // signup without a cookie.
      console.error(
        '[referral] code lookup failed:',
        err instanceof Error ? err.message : 'Unknown error'
      );
    }
  }

  const response = NextResponse.redirect(new URL('/signup', request.url));
  if (valid && code) {
    response.cookies.set(REFERRAL_COOKIE, code, referralCookie);
  }
  return response;
}
