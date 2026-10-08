import Link from 'next/link';
import { ArrowRight, Gift } from 'lucide-react';
import Reveal from '@/components/landing/Reveal';

/**
 * Tasteful referral callout for the landing page, placed under the pricing
 * cards. It explains the program to signed-out visitors (who have no code yet)
 * and points them at signup, where their own link is issued. Copy mirrors the
 * in-app wording so the promise never drifts from the actual reward.
 */
export default function ReferralCallout() {
  return (
    <Reveal className="mx-auto mt-10 flex w-full max-w-[900px] flex-col items-start gap-5 rounded-2xl border border-sandline bg-cream p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
        <Gift aria-hidden="true" className="h-6 w-6" />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="font-fraunces text-xl font-bold leading-snug text-ink sm:text-2xl">
          Earn a free certificate for every friend
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-clay">
          Invite a friend. When they join and verify their account, you earn 1 extra certificate per
          month - on top of your monthly allowance. There is no limit: 10 friends, 10 extra
          certificates every month.
        </p>
      </div>

      <Link
        href="/signup"
        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-[background-color,transform] duration-150 hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream active:scale-[0.98] sm:w-auto"
      >
        Get your link
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </Reveal>
  );
}
