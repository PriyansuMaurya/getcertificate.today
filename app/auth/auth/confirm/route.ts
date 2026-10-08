import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { safeNextPath } from '@/lib/safe-next';
import { settleReferralOnVerifiedEmail } from '@/utils/referrals';
import { redirect } from 'next/navigation';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  // Same-origin relative path only - blocks open-redirect via ?next=https://evil.com
  const next = safeNextPath(searchParams.get('next'));

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // Email is now confirmed: settle any referral for this account (verify +
      // grant the referrer's credit exactly once). Best-effort - a referral
      // failure must never block the confirmation redirect; a later sign-in
      // retries the settlement, which is idempotent.
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          await settleReferralOnVerifiedEmail(user.id);
        }
      } catch (err) {
        console.error(
          '[referral] settlement after email confirm failed:',
          err instanceof Error ? err.message : 'Unknown error'
        );
      }
      // redirect user to specified redirect URL or root of app
      redirect(next);
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/error');
}
