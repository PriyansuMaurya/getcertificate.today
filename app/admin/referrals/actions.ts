'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '../require-admin';
import { reverseReferralReward } from '@/utils/referrals';

export type AdminReferralActionState = { message: string; success?: boolean };

/**
 * Reverse a referral reward from the admin console.
 *
 * Authorization is enforced here, server-side, on every call: requireAdmin()
 * redirects signed-out callers to /login and 404s non-admins (and suspended
 * admins) before any mutation. Hiding the button is never the boundary.
 *
 * The reversal itself is idempotent (utils/referrals.reverseReferralReward):
 * the append-only ledger's unique (referral_id, reason='reversal') means a
 * retried submit cannot claw back more than the one credit that was awarded.
 */
export async function reverseReferralRewardAction(
  _currentState: AdminReferralActionState,
  formData: FormData
): Promise<AdminReferralActionState> {
  await requireAdmin();

  const referralId = (formData.get('referralId') as string | null)?.trim() ?? '';
  if (!referralId || referralId.length > 128) {
    return { message: 'Missing or invalid referral id.' };
  }

  try {
    const result = await reverseReferralReward(referralId);
    if (result.reversed) {
      revalidatePath('/admin/referrals');
      return { message: 'Reward reversed. A -1 credit was recorded in the ledger.', success: true };
    }
    if (result.reason === 'already_reversed') {
      return { message: 'This reward was already reversed - nothing further to do.' };
    }
    if (result.reason === 'not_awarded') {
      return { message: 'This reward is not currently awarded, so there is nothing to reverse.' };
    }
    return { message: 'That referral no longer exists.' };
  } catch (err) {
    console.error(
      '[admin] referral reward reversal failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not reverse this reward. Please try again.' };
  }
}
