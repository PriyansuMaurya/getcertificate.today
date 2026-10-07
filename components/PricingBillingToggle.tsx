'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PRICING_PLANS, type BillingPeriod } from '@/utils/plans';

/**
 * Monthly/Yearly segmented control shared by the landing pricing section and
 * /subscribe. Rendered as a pressed-button group (the selected period is the
 * only `aria-pressed` button), with the Pro yearly saving advertised inline.
 *
 * The selected period is drawn as one surface that travels between the two
 * buttons rather than two alternating backgrounds, so the state change reads as
 * the same control moving rather than as two unrelated styles swapping. Motion's
 * `layoutId` does the travel; it is the one JS-driven animation in this file, so
 * `prefers-reduced-motion` is honoured here rather than by globals.css, which can
 * only reach CSS animations (see the `reduce` branch below).
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
  const reduce = useReducedMotion();
  // `layoutId` is global to the Motion tree, so it is scoped per instance. The
  // landing pricing section and /subscribe each render their own toggle and never
  // together, so this is defensive rather than a fix - but an unscoped id would
  // send one pill across the page the first time both did co-render.
  const pillId = useId();

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
              'relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold leading-[1.366] transition-[color,background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.98]',
              active ? 'text-cream' : 'text-clay hover:text-ink',
            ].join(' ')}
          >
            {/* The travelling surface. Reduced motion keeps the state change - the
                pill is simply already in place rather than sliding there. */}
            {active && (
              <motion.span
                aria-hidden="true"
                layoutId={`billing-period-pill-${pillId}`}
                className="absolute inset-0 z-0 rounded-full bg-ink"
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', duration: 0.5, bounce: 0.2 }
                }
              />
            )}
            <span className="relative z-10">{period === 'monthly' ? 'Monthly' : 'Yearly'}</span>
            {period === 'yearly' && yearlySavings ? (
              <span
                className={[
                  'relative z-10 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
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
