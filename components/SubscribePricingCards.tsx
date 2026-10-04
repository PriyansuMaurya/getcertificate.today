import { CheckIcon } from '@/components/icons';
import { startCheckout } from '@/app/subscribe/actions';
import SubscribeCheckoutButton from '@/components/SubscribeCheckoutButton';

// Copy + tier order taken from the supplied design screenshot; colors follow
// the site Figma tokens (ink highlight instead of the screenshot's purple,
// per product decision).
//
// Feature bullets list ONLY capabilities that exist in this codebase
// (assessments, progress tracking, credentials, free quota) - the previous
// screenshot copy advertised mentor sessions, webinars, and reports that
// were never built, which is a deceptive-claims risk (FTC Act §5). Tier
// differentiation beyond that is a product decision (see
// docs/LEGAL_COMPLIANCE_AUDIT.md).
export const PLANS = [
  {
    key: 'basic',
    name: 'Basic Plan',
    price: 9,
    popular: false,
    tagline: 'The essentials',
    sub: 'AI assessments for any video, plus certificates with QR codes and share links.',
    features: [
      'AI-generated assessments for any video',
      'Progress-tracking learning player',
      'Unlimited verified certificates with QR + share links',
      'Cancel anytime from settings',
    ],
  },
  {
    key: 'popular',
    name: 'Professional',
    price: 19,
    popular: true,
    tagline: 'Public verification',
    sub: 'Everything in Basic, plus a public page anyone can check.',
    features: [
      'Everything in Basic',
      'Public credential verification pages',
      'Unlimited verified certificates',
      'Cancel anytime from settings',
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    price: 39,
    popular: false,
    tagline: 'Every feature',
    sub: 'Everything in Professional, included.',
    features: [
      'Everything in Professional',
      'All platform features included',
      'Unlimited verified certificates',
      'Cancel anytime from settings',
    ],
  },
] as const;

export default function SubscribePricingCards({
  subscribed = false,
  billingUrl = null,
}: {
  subscribed?: boolean;
  billingUrl?: string | null;
}) {
  // Subscribers never see checkout buttons - even when the portal link failed
  // to generate, fall back to settings (which hosts the billing portal link)
  // instead of offering a second subscription.
  const manageHref = billingUrl ?? '/dashboard/settings';
  return (
    <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
      {PLANS.map((plan) => {
        const action = startCheckout.bind(null, plan.key);
        return (
          <div
            key={plan.key}
            className={[
              'flex flex-col rounded-2xl border bg-paper p-6 transition-shadow sm:p-8',
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
              <div className="flex items-baseline gap-1">
                <span className="font-fraunces text-[48px] font-black leading-none text-ink">
                  ${plan.price}
                </span>
                <span className="text-sm leading-[1.366] text-clay">per month</span>
              </div>
              {subscribed ? (
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
              ) : (
                <form action={action}>
                  <SubscribeCheckoutButton popular={plan.popular} />
                </form>
              )}
            </div>

            <div className="mt-6 border-t border-sandline pt-6">
              <p className="text-[15px] font-bold leading-[1.366] text-ink">{plan.tagline}</p>
              <p className="mt-1 text-sm leading-[1.366] text-clay">{plan.sub}</p>
              <ul className="mt-5 flex flex-col gap-3.5">
                {plan.features.map((feat) => (
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
  );
}
