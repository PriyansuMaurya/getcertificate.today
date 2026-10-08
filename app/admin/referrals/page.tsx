import Link from 'next/link';
import { requireAdmin } from '../require-admin';
import { listRecentReferrals } from '@/utils/referrals';
import ReferralRewardActions from '@/components/admin/ReferralRewardActions';
import { Gift } from 'lucide-react';

export const metadata = {
  title: 'Referrals',
  description: 'Referral activity and reward reversal.',
};

const STATUS_STYLES: Record<string, string> = {
  verified: 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700',
  pending: 'border-amber-600/30 bg-amber-500/10 text-amber-800',
  rejected: 'border-red-600/20 bg-red-500/10 text-red-700',
};

function rewardLabel(status: string): string {
  if (status === 'awarded') return '+1 credit';
  if (status === 'not_applicable') return 'Paid plan';
  if (status === 'reversed') return 'Reversed';
  return 'Not awarded';
}

function label(username: string | null, email: string): string {
  return username ? `@${username}` : email;
}

export default async function AdminReferralsPage() {
  // Layout already gates /admin; each page re-checks per convention.
  await requireAdmin();

  const referrals = await listRecentReferrals();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Referral program</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Referrals</h1>
        <p className="text-sm text-clay sm:text-base">
          Every attributed referral and its reward status. Reversing a reward appends a -1 entry to
          the credit ledger; it never edits history.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8">
        {referrals.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl bg-cream p-4">
            <Gift aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
            <div>
              <p className="text-sm font-semibold text-ink">No referrals yet</p>
              <p className="mt-1 text-xs leading-relaxed text-clay">
                Attributed signups and their rewards will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-sandline text-xs uppercase tracking-wider text-clay">
                  <th scope="col" className="pb-3 pr-4 font-bold">
                    Referrer
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-bold">
                    Referred
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-bold">
                    Verified
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-bold">
                    Reward
                  </th>
                  <th scope="col" className="pb-3 font-bold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-sandline/60 last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/admin/users/${r.referrerUserId}`}
                        className="font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {label(r.referrerUsername, r.referrerEmail)}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-clay">
                      {label(r.referredUsername, r.referredEmail)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          STATUS_STYLES[r.verificationStatus] ??
                          'border-sandline bg-cream text-clay'
                        }`}
                      >
                        {r.verificationStatus}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-clay">{rewardLabel(r.rewardStatus)}</td>
                    <td className="py-3">
                      {r.rewardStatus === 'awarded' ? (
                        <ReferralRewardActions referralId={r.id} />
                      ) : (
                        <span className="text-xs text-clay">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
