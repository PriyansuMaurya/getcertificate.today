'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckIcon } from '@/components/icons';
import PricingBillingToggle from '@/components/PricingBillingToggle';
import Reveal from '@/components/landing/Reveal';
import { PRICING_PLANS, activeCheckout, formatEuro, type BillingPeriod } from '@/utils/plans';

/**
 * Landing-page pricing grid. Client component so the Monthly/Yearly toggle can
 * drive the displayed price. Keeps the Figma landing styles (paper cards, ink
 * card for the popular tier) and shares the tier data with /subscribe
 * (PRICING_PLANS in utils/plans.ts).
 */
export default function LandingPricingCards() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Revealed with the heading above and the cards below, so the pricing band
          arrives as one gesture instead of the toggle popping in between two
          animated groups. */}
      <Reveal className="flex justify-center">
        <PricingBillingToggle value={period} onChange={setPeriod} />
      </Reveal>

      {/* `w-full` matters: without it this row is a fit-content flex item (its
          parent centres its children), so each card's `w-full max-w-[...]`
          resolved against a fit-content box and the cards silently resized
          whenever the yearly badge changed their content width. */}
      <div className="flex w-full flex-col items-center gap-6 md:gap-8 lg:flex-row lg:items-start lg:justify-center">
        {PRICING_PLANS.map((plan, index) => {
          const price = activeCheckout(plan, period);
          const features = [plan.quota[period], ...plan.features];
          const monthlyOnly = period === 'yearly' && !plan.yearly && Boolean(plan.monthly);

          return (
            <Reveal
              key={plan.id}
              delay={index * 0.08}
              className={[
                // `min-w-0` drops the flex min-content floor, so when the row is
                // tight (lg-xl) the shrink is shared by width rather than by the
                // longest card, which is what made the widths depend on the
                // yearly badge and jump on toggle.
                // Padding steps back to p-8 in the lg band: that is the one range
                // where three cards, the 48px amount and 48px of padding cannot
                // all fit (the row is ~64px short at 1024), and the amount is not
                // allowed to wrap - see the price block below.
                'lift-card flex w-full min-w-0 flex-col gap-8 rounded-2xl p-6 sm:p-8 md:p-12 lg:p-8 xl:p-12',
                plan.popular
                  ? 'max-w-[420px] bg-ink shadow-figma-pro'
                  : 'max-w-[400px] border border-sandline bg-cream',
              ].join(' ')}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3
                    className={[
                      'text-lg font-bold leading-[1.366]',
                      plan.popular ? 'text-cream' : 'text-ink',
                    ].join(' ')}
                  >
                    {plan.name}
                  </h3>
                  {plan.popular && (
                    <span className="rounded-full bg-sand px-3 py-1 text-[11px] font-bold leading-[1.366] text-ink">
                      POPULAR
                    </span>
                  )}
                </div>
                <p
                  className={[
                    'text-sm leading-[1.366]',
                    plan.popular ? 'text-sand' : 'text-clay',
                  ].join(' ')}
                >
                  {plan.tagline}
                </p>
              </div>

              {/* The amount line never wraps, and the strip under it is reserved
                  in all three cards. The yearly saving badge and the "Billed
                  monthly" note share that strip, so neither can push one card's
                  feature list and CTA out of line with the other two.
                  The card classes deliberately carry no min-content floor, so this
                  row cannot be allowed to grow - see the invariant above
                  PRICING_PLANS in utils/plans.ts before changing an amount or the
                  period wording. */}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-x-1 whitespace-nowrap">
                  <span
                    className={[
                      'font-fraunces text-[48px] font-black leading-[1.233]',
                      plan.popular ? 'text-cream' : 'text-ink',
                    ].join(' ')}
                  >
                    {formatEuro(price?.amount ?? 0)}
                  </span>
                  <span
                    className={[
                      'text-[15px] leading-[1.366]',
                      plan.popular ? 'text-sand' : 'text-clay',
                    ].join(' ')}
                  >
                    {price?.period === 'year' ? '/ year' : '/ month'}
                  </span>
                </div>
                {/* Reserved height: 11px badge text × leading 1.366 + py-1 (8px)
                    ≈ 23px, so the strip holds the badge and the plain note at
                    the same height. Keep this if either changes. */}
                <div className="flex min-h-[23px] items-center">
                  {price?.savingsPercent ? (
                    <span
                      className={[
                        'rounded-full px-2.5 py-1 text-[11px] font-bold leading-[1.366]',
                        plan.popular ? 'bg-sand text-ink' : 'bg-linen text-clay',
                      ].join(' ')}
                    >
                      Save {price.savingsPercent}%
                    </span>
                  ) : monthlyOnly ? (
                    <span
                      className={[
                        'text-[11px] leading-[1.366]',
                        plan.popular ? 'text-sand' : 'text-clay',
                      ].join(' ')}
                    >
                      Billed monthly
                    </span>
                  ) : null}
                </div>
              </div>

              <ul className="flex flex-col gap-4">
                {features.map((feat) => (
                  <li key={feat} className="flex items-center gap-3">
                    <CheckIcon className="h-4 w-4 shrink-0 text-sand" />
                    <span
                      className={[
                        'text-sm leading-[1.366]',
                        plan.popular ? 'text-cream' : 'text-ink',
                      ].join(' ')}
                    >
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.id === 'free' ? '/signup' : '/subscribe'}
                className={[
                  'flex h-12 items-center justify-center rounded-lg px-6 py-3.5 text-[15px] font-bold leading-[1.366] transition-[background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]',
                  // The ring colour follows the surface the button sits on: sand on
                  // the ink card (terracotta against ink is only ~2:1, which would
                  // disappear), terracotta on the cream ones.
                  plan.popular
                    ? 'bg-sand text-cream hover:bg-sand/90 focus-visible:ring-sand focus-visible:ring-offset-ink'
                    : 'border-[1.5px] border-ink text-ink hover:bg-ink/5 focus-visible:ring-terracotta focus-visible:ring-offset-cream',
                ].join(' ')}
              >
                Get Started
              </Link>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
