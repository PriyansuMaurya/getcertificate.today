import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { getReferralPanelData, listReferralsForUser } from '@/utils/referrals';
import { planLabel } from '@/utils/plans';
import { getSettings } from '@/utils/settings';
import { referralUrl } from '@/lib/referral-code';
import ReferralEarnCard from '@/components/referrals/ReferralEarnCard';
import { Users } from 'lucide-react';

export const metadata = {
  title: 'Referrals | getcertificate.today',
  description: 'Share your referral link, earn free certificates, and track who joined through you.',
};

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

const STATUS_STYLES: Record<string, string> = {
  verified: 'border-emerald-600/20 bg-emerald-500/10 text-emerald-700',
  pending: 'border-amber-600/30 bg-amber-500/10 text-amber-800',
  rejected: 'border-red-600/20 bg-red-500/10 text-red-700',
};

function statusLabel(status: string): string {
  if (status === 'verified') return 'Verified';
  if (status === 'pending') return 'Pending email';
  if (status === 'rejected') return 'Rejected';
  return status;
}

/** Human label for the reward column (award/paid-plan/reversed/none). */
function rewardLabel(status: string): string {
  if (status === 'awarded') return '+1 certificate';
  if (status === 'not_applicable') return 'Paid plan - no credit';
  if (status === 'reversed') return 'Reversed';
  return 'Not awarded yet';
}

/** Referred users are shown by username; fall back to a masked email. */
function referredUserLabel(username: string | null, email: string): string {
  if (username) return `@${username}`;
  const [local, domain] = email.split('@');
  const masked = local.length <= 2 ? `${local[0] ?? ''}•` : `${local.slice(0, 2)}•••`;
  return `${masked}@${domain ?? ''}`;
}

export default async function ReferralsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profileRows = await db
    .select({ referral_code: usersTable.referral_code, plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  const profile = profileRows[0];
  // The dashboard layout already guarantees onboarding is complete, so a row
  // must exist. Redirect defensively rather than render an empty page.
  if (!profile) redirect('/dashboard');

  // Panel data comes from ONE shared helper (utils/referrals.ts) and is rendered
  // by the SAME ReferralEarnCard the dashboard uses - so the share link, the
  // grouped counts and the remaining allowance cannot drift between surfaces or
  // from the quota the mint path enforces.
  const [referrals, { freeCredentialsPerMonth }] = await Promise.all([
    listReferralsForUser(user.id),
    getSettings(),
  ]);
  const panel = await getReferralPanelData({
    userId: user.id,
    plan: profile.plan,
    referralCode: profile.referral_code,
    freeCredentialsPerMonth,
  });

  return (
    <main id="main-content" className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Refer &amp; earn</h1>
          <p className="text-sm text-clay sm:text-base">
            Share your personal link and track every friend who joins through it.
          </p>
        </div>

        <ReferralEarnCard
          code={panel.code}
          url={referralUrl(panel.code, PUBLIC_URL)}
          verifiedCount={panel.counts.verified}
          credits={panel.credits}
          remaining={panel.remaining}
          monthlyLimit={panel.monthlyLimit}
          usedThisMonth={panel.usedThisMonth}
          planName={planLabel(profile.plan)}
        />

        {/* Referral list */}
        <section
          aria-labelledby="referral-list-heading"
          className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <h2 id="referral-list-heading" className="font-fraunces text-xl font-bold text-ink">
            Your referrals
          </h2>

          {referrals.length === 0 ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-cream p-4">
              <Users aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
              <div>
                <p className="text-sm font-semibold text-ink">No referrals yet</p>
                <p className="mt-1 text-xs leading-relaxed text-clay">
                  Share your link above - new signups will appear here as soon as they join.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-sandline text-xs uppercase tracking-wider text-clay">
                    <th scope="col" className="pb-3 pr-4 font-bold">
                      Referred user
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-bold">
                      Signed up
                    </th>
                    <th scope="col" className="pb-3 pr-4 font-bold">
                      Status
                    </th>
                    <th scope="col" className="pb-3 font-bold">
                      Reward
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-sandline/60 last:border-0">
                      <td className="py-3 pr-4 font-semibold text-ink">
                        {referredUserLabel(r.referredUsername, r.referredEmail)}
                      </td>
                      <td className="py-3 pr-4 text-clay">
                        {r.createdAt.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                            STATUS_STYLES[r.verificationStatus] ??
                            'border-sandline bg-cream text-clay'
                          }`}
                        >
                          {statusLabel(r.verificationStatus)}
                        </span>
                      </td>
                      <td className="py-3 text-clay">{rewardLabel(r.rewardStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
