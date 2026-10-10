import Link from 'next/link';
import { ArrowRight, BadgeCheck, Gift, Sparkles, Users } from 'lucide-react';
import CopyReferralLink from './CopyReferralLink';

export type ReferralEarnCardProps = {
  code: string;
  url: string;
  /** Friends who joined and verified their account. */
  verifiedCount: number;
  /** Certificate credits earned from referrals (ledger balance). */
  credits: number;
  /** Certificates still available this month, or null when unlimited. */
  remaining: number | null;
  /** The plan's monthly allowance (base free allowance + credits), or null. */
  monthlyLimit: number | null;
  /** Certificates already minted this month. */
  usedThisMonth: number;
  /** Human plan label (Free/Starter/Pro). */
  planName: string;
  /** When true, links out to the full /dashboard/referrals page. */
  showViewAll?: boolean;
};

/**
 * The "Earn Free Certificates" referral panel, shared by the main dashboard and
 * (optionally) the referrals page. Presentational only: every number is
 * computed by the caller from the same quota model the mint path enforces
 * (base free allowance + earned credits - certificates minted this month), so
 * there is no separate balance that can drift from the certificate limit.
 */
export default function ReferralEarnCard({
  code,
  url,
  verifiedCount,
  credits,
  remaining,
  monthlyLimit,
  usedThisMonth,
  planName,
  showViewAll = false,
}: ReferralEarnCardProps) {
  const stats = [
    {
      label: 'Successful referrals',
      value: String(verifiedCount),
      icon: Users,
      help: 'Friends who joined and verified',
    },
    {
      label: 'Certificates earned',
      value: String(credits),
      icon: Sparkles,
      help: 'Extra certificates from referrals',
    },
    {
      label: 'Remaining allowance',
      value: remaining === null ? 'Unlimited' : String(remaining),
      icon: BadgeCheck,
      help:
        remaining === null
          ? `${planName}: unlimited certificates`
          : `${usedThisMonth} of ${monthlyLimit ?? '∞'} used this month`,
    },
  ];

  return (
    <section
      aria-labelledby="referral-earn-heading"
      className="mt-8 overflow-hidden rounded-2xl border border-sandline bg-paper"
    >
      {/* Accent rail keeps the panel obvious without a full-colour surface. */}
      <div className="border-l-4 border-terracotta p-5 sm:p-8">
        <div className="flex items-start gap-3">
          {/* Decorative icon tile dropped on phones - it crowds the heading
              once the panel falls back to p-5 padding. */}
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta sm:flex">
            <Gift aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-wider text-sand">
              Earn free certificates
            </p>
            <h2
              id="referral-earn-heading"
              className="mt-1 font-fraunces text-xl font-bold text-ink sm:text-2xl"
            >
              Invite a friend, earn a certificate
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-clay">
              Invite a friend. When they join and verify their account, you earn 1 extra certificate
              per month. There is no limit - 10 friends, 10 extra certificates per month.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-cream p-4 sm:p-5">
          <CopyReferralLink code={code} url={url} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, help }) => (
            <div key={label} className="rounded-xl border border-sandline bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-clay">{label}</h3>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-fraunces text-3xl font-black text-ink">{value}</p>
              <p className="mt-0.5 text-xs text-clay">{help}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-clay">
          {planName === 'Free'
            ? 'Referral certificates are added to your Free monthly allowance and kept if you change plans.'
            : 'You are on the ' +
              planName +
              ' plan. Referral certificates are saved and apply again if you return to Free.'}
        </p>

        {showViewAll && (
          <Link
            href="/dashboard/referrals"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-ink underline underline-offset-4 transition-colors hover:text-clay"
          >
            View all referrals
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>
    </section>
  );
}
