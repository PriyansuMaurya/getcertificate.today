import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Gift,
  Info,
  Plus,
  Share2,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

/** One column of the panel's stat strip. */
type EarnStat = {
  label: string;
  value: string;
  icon: LucideIcon;
  help: string;
  /** Available headroom, shown only when the plan has a finite allowance. */
  meter?: { value: number; max: number };
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
  // Available headroom rather than usage, so a brand-new account reads as a
  // full jar instead of an empty one. Omitted for unlimited plans, where a
  // ratio means nothing.
  const allowanceMeter =
    remaining !== null && monthlyLimit && monthlyLimit > 0
      ? { value: remaining, max: monthlyLimit }
      : undefined;

  const stats: EarnStat[] = [
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
      meter: allowanceMeter,
    },
  ];

  const steps = [
    { icon: Share2, label: 'Share your link' },
    { icon: UserCheck, label: 'They join and verify' },
    { icon: Plus, label: 'You earn 1 certificate' },
  ];

  return (
    <section
      aria-labelledby="referral-earn-heading"
      className="mt-8 overflow-hidden rounded-2xl border border-sandline bg-paper shadow-figma-pro"
    >
      {/* A full-width accent band replaces the old left rail: it reads as a
          header, and it lets the warm tint behind the offer do the work of
          making the panel obvious without a full-colour surface. */}
      <div aria-hidden="true" className="h-1 w-full bg-terracotta" />

      <header className="border-b border-sandline bg-terracotta-tint px-5 py-6 sm:px-8 sm:py-7">
        {/* The gift tile is dropped on phones - it crowds the kicker once the
            panel falls back to p-5 padding - and returns from sm up. The
            headline sits on its own row so it always keeps the full width. */}
        <div className="flex items-center gap-3">
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta text-cream sm:flex">
            <Gift aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <p className="min-w-0 text-[13px] font-bold uppercase tracking-wider text-terracotta-deep">
            Earn free certificates
          </p>
        </div>
        <h2
          id="referral-earn-heading"
          className="mt-2 font-fraunces text-xl font-bold text-ink sm:text-2xl"
        >
          Invite a friend, earn a certificate
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-clay">
          Invite a friend. When they join and verify their account, you earn 1 extra certificate per
          month. There is no limit - 10 friends, 10 extra certificates per month.
        </p>

        {/* The mechanic, shown rather than described: three icons carry the
            promise the paragraph above makes. Arrows are desktop-only so the
            row collapses to a plain stack on phones instead of pointing down. */}
        <ol className="mt-5 flex flex-col gap-3 border-t border-terracotta/15 pt-4 sm:flex-row sm:items-center sm:gap-4">
          {steps.map(({ icon: Icon, label }, i) => (
            <li key={label} className="flex items-center gap-3 sm:gap-4">
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-terracotta-deep ring-1 ring-terracotta/20">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold text-clay">{label}</span>
              </span>
              {i < steps.length - 1 && (
                <ArrowRight
                  aria-hidden="true"
                  className="hidden h-3.5 w-3.5 shrink-0 text-terracotta/50 sm:block"
                />
              )}
            </li>
          ))}
        </ol>
      </header>

      <div className="p-5 sm:p-8">
        <div className="rounded-xl border border-sandline bg-cream p-4 sm:p-5">
          <CopyReferralLink code={code} url={url} />
        </div>

        {/* One divided panel rather than three bordered cards: the numbers are a
            single answer set, so hairlines separate them instead of boxes. */}
        <div className="mt-5 grid grid-cols-1 overflow-hidden rounded-xl border border-sandline bg-paper sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, help, meter }) => (
            <div
              key={label}
              className="border-t border-sandline p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:p-5 sm:first:border-l-0"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-clay">{label}</h3>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 font-fraunces text-3xl font-black text-ink">{value}</p>
              {meter && (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={meter.max}
                  aria-valuenow={meter.value}
                  aria-label={`${meter.value} of ${meter.max} certificates remaining this month`}
                  className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-linen"
                >
                  <div
                    className="h-full rounded-full bg-terracotta"
                    style={{ width: `${Math.round((meter.value / meter.max) * 100)}%` }}
                  />
                </div>
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-clay">{help}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-clay">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {planName === 'Free'
              ? 'Referral certificates are added to your Free monthly allowance and kept if you change plans.'
              : 'You are on the ' +
                planName +
                ' plan. Referral certificates are saved and apply again if you return to Free.'}
          </span>
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
