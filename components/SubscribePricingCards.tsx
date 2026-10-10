'use client';

import { useState } from 'react';
import { CheckIcon } from '@/components/icons';
import { startCheckout } from '@/app/subscribe/actions';
import SubscribeCheckoutButton from '@/components/SubscribeCheckoutButton';
import PricingBillingToggle from '@/components/PricingBillingToggle';
import { PRICING_PLANS, activeCheckout, formatEuro, type BillingPeriod } from '@/utils/plans';

// Copy + tier order live in utils/plans.ts (PRICING_PLANS) so the landing page
// and /subscribe render the same three tiers. Feature bullets list ONLY
// capabilities that exist in this codebase (assessments, progress tracking,
// certificates, verification) - tier differentiation is the certificate
// allowance (docs/LEGAL_COMPLIANCE_AUDIT.md). Colors follow the site Figma
// tokens.
export default function SubscribePricingCards({
  subscribed = false,
  billingUrl = null,
}: {
  subscribed?: boolean;
  billingUrl?: string | null;
}) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  // Subscribers never see checkout buttons - even when the portal link failed
  // to generate, fall back to settings (which hosts the billing portal link)
  // instead of offering a second subscription.
  const manageHref = billingUrl ?? '/dashboard/settings';

  return (
    <div className="flex flex-col items-center gap-8">
      <PricingBillingToggle value={period} onChange={setPeriod} />

      {/* Three across from lg, matching the landing grid: at md the columns are
          ~224px wide, which cannot hold the 48px amount line once it is not
          allowed to wrap (it is kept on one line so the period toggle cannot
          change a card's height - see the price block below). */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {PRICING_PLANS.map((plan) => {
          const price = activeCheckout(plan, period);
          const features = [plan.quota[period], ...plan.features];
          const action = price ? startCheckout.bind(null, price.key) : null;
          // Yearly selected but this tier has no yearly price (Free, Starter):
          // the card keeps showing its monthly price.
          const monthlyOnly = period === 'yearly' && !plan.yearly && Boolean(plan.monthly);

          return (
            <div
              key={plan.id}
              className={[
                // `min-w-0` keeps the three grid tracks equal instead of letting a
                // card's longest bit of content (the yearly badge) widen its own
                // column when the period changes.
                // The lg band is the tight one for the same reason as the landing
                // cards: three cards, a 48px amount and 48px of padding compete for
                // the row, so the padding steps back there and returns at xl.
                'flex min-w-0 flex-col rounded-2xl border bg-paper p-6 transition-shadow sm:p-8 lg:p-6 xl:p-8',
                plan.popular
                  ? 'border-ink shadow-figma-pro'
                  : 'border-sandline shadow-figma-hero hover:shadow-figma-pro',
              ].join(' ')}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold leading-[1.366] text-ink">{plan.name}</h3>
                  {plan.popular && (
                    <span className="rounded-full bg-ink px-3 py-1 text-[11px] font-bold leading-[1.366] text-cream">
                      POPULAR
                    </span>
                  )}
                </div>
                {/* Same structure as the landing cards: the amount line never
                    wraps and the badge/note strip below is reserved, so the
                    yearly saving badge and the "Billed monthly" note do not
                    shift the rows under them. */}
                <div className="flex items-baseline gap-x-1 whitespace-nowrap">
                  <span className="font-fraunces text-[48px] font-black leading-none text-ink">
                    {formatEuro(price?.amount ?? 0)}
                  </span>
                  <span className="text-sm leading-[1.366] text-clay">
                    {price?.period === 'year' ? 'per year' : 'per month'}
                  </span>
                </div>
                {/* Reserved height matching the landing cards (11px text ×
                    leading 1.366 + py-1 ≈ 23px) so both pricing surfaces agree. */}
                <div className="flex min-h-[23px] items-center">
                  {price?.savingsPercent ? (
                    <span className="rounded-full bg-linen px-2.5 py-1 text-[11px] font-bold leading-[1.366] text-clay">
                      Save {price.savingsPercent}%
                    </span>
                  ) : monthlyOnly ? (
                    <span className="text-[11px] leading-[1.366] text-clay">Billed monthly</span>
                  ) : null}
                </div>

                {plan.id === 'free' ? (
                  subscribed ? (
                    <a
                      href={manageHref}
                      className="flex h-11 w-full items-center justify-center rounded-lg bg-linen px-6 text-[15px] font-bold leading-[1.366] text-ink transition-colors hover:bg-sandline"
                    >
                      Change plan
                    </a>
                  ) : (
                    <span className="flex h-11 w-full items-center justify-center rounded-lg border border-sandline bg-cream px-6 text-[15px] font-bold leading-[1.366] text-clay">
                      Current plan
                    </span>
                  )
                ) : subscribed ? (
                  // Already paying: swap checkout for the billing portal so
                  // users can't buy a second subscription from the same cards.
                  <a
                    href={manageHref}
                    className={[
                      'flex h-11 w-full items-center justify-center rounded-lg px-6 text-[15px] font-bold leading-[1.366] transition-colors',
                      plan.popular
                        ? 'bg-ink text-cream hover:bg-ink/90'
                        : 'bg-linen text-ink hover:bg-sandline',
                    ].join(' ')}
                  >
                    Manage billing
                  </a>
                ) : action ? (
                  <form action={action}>
                    <SubscribeCheckoutButton popular={plan.popular} />
                  </form>
                ) : null}
              </div>

              <div className="mt-6 border-t border-sandline pt-6">
                <p className="text-[15px] font-bold leading-[1.366] text-ink">{plan.tagline}</p>
                <p className="mt-1 text-sm leading-[1.366] text-clay">{plan.sub}</p>
                <ul className="mt-5 flex flex-col gap-3.5">
                  {features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ink"
                      >
                        <CheckIcon className="h-2.5 w-2.5 text-cream" />
                      </span>
                      <span className="text-sm leading-[1.366] text-ink">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
