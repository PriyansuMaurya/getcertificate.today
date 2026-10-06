'use client';

import { PRICING_PLANS, type BillingPeriod } from '@/utils/plans';

/**
 * Monthly/Yearly segmented control shared by the landing pricing section and
 * /subscribe. Rendered as a pressed-button group (the selected period is the
 * only `aria-pressed` button), with the Pro yearly saving advertised inline.
 */
export default function PricingBillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  // Derived from the plan data so the advertised saving can never drift from
  // the actual Pro yearly price (utils/plans.ts).
  const yearlySavings = PRICING_PLANS.find((p) => p.yearly?.savingsPercent)?.yearly?.savingsPercent;

  return (
    <div
      role="group"
      aria-label="Billing period"
      className="inline-flex items-center gap-1 rounded-full border border-sandline bg-paper p-1"
    >
      {(['monthly', 'yearly'] as const).map((period) => {
        const active = value === period;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period)}
            className={[
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold leading-[1.366] transition-colors',
              active ? 'bg-ink text-cream' : 'text-clay hover:text-ink',
            ].join(' ')}
          >
            {period === 'monthly' ? 'Monthly' : 'Yearly'}
            {period === 'yearly' && yearlySavings ? (
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  active ? 'bg-sand text-ink' : 'bg-linen text-clay',
                ].join(' ')}
              >
                Save {yearlySavings}%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
