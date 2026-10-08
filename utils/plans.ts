// Plan + pricing model - the single source of truth shared by the pricing UI
// (client components) and server-side enforcement (quota checks, webhook).
//
// `users_table.plan` stores the entitlement key: 'none' for free accounts, or a
// paid tier key ('starter' | 'pro' | 'pro_yearly'). The Stripe webhook writes
// the key from the subscription's price (app/webhook/stripe/route.ts), so quota
// enforcement and plan labels read it locally - no Stripe round-trip. Rows from
// the pre-tier schema (a Stripe subscription id, or the retired USD plan keys)
// are still recognised and grandfathered (see paidTierOf).
//
// Deliberately free of server-only imports so it can also be imported from
// client components (the pricing cards). It imports nothing from
// utils/credentials.ts (that module imports this one instead) so there is no
// circular dependency.

/** Paid tiers stored in `users_table.plan`. */
export type PaidPlanTier = 'starter' | 'pro' | 'pro_yearly';

export const PAID_PLAN_TIERS = ['starter', 'pro', 'pro_yearly'] as const;

/**
 * Certificates per calendar month per paid tier. `null` = unlimited.
 * Fixed by the pricing tiers (not admin-tunable); free accounts use the
 * admin-tunable `app_settings.free_credentials_per_month` instead.
 */
export const TIER_CERTIFICATE_LIMITS: Record<PaidPlanTier, number | null> = {
  starter: 10,
  pro: 30,
  pro_yearly: null, // unlimited
};

export function isPaidPlanTier(value: unknown): value is PaidPlanTier {
  return typeof value === 'string' && (PAID_PLAN_TIERS as readonly string[]).includes(value);
}

/** Retired plan names from the earlier USD tiers; grandfathered as unlimited Pro. */
const RETIRED_PLAN_KEYS = ['basic', 'popular', 'premium'] as const;

/**
 * True for the Stripe subscription ids written by the pre-tier schema (every
 * subscription id begins with `sub_`). Those accounts were sold unlimited
 * certificates, so they keep them.
 */
function isLegacySubscriptionId(value: string): boolean {
  return value.startsWith('sub_');
}

/**
 * Resolves a stored `plan` value to a paid tier, or null for free/unknown.
 *
 * Recognised: the current tier keys, the legacy Stripe subscription ids (any
 * `sub_` value is trusted as one) and the retired USD plan keys. The last two
 * were sold as unlimited Pro, so they stay grandfathered. Any other non-'none'
 * value is unexpected - a typo or a hand-edited row - and falls back to free
 * rather than silently granting unlimited Pro.
 */
export function paidTierOf(plan: string | null | undefined): PaidPlanTier | null {
  if (isPaidPlanTier(plan)) return plan;
  if (typeof plan !== 'string' || plan === '' || plan === 'none') return null;
  // Grandfather the two legacy shapes: a stored Stripe subscription id and the
  // retired USD plan keys.
  if (isLegacySubscriptionId(plan) || (RETIRED_PLAN_KEYS as readonly string[]).includes(plan)) {
    return 'pro_yearly';
  }
  return null;
}

/** Human-readable plan label for display (dashboard, admin, settings). */
export function planLabel(plan: string | null | undefined): string {
  const tier = paidTierOf(plan);
  if (tier === 'starter') return 'Starter';
  if (tier) return 'Pro';
  return 'Free';
}

/**
 * Monthly certificate allowance for a plan. `null` = unlimited. Free accounts
 * fall back to the live admin setting, plus any referral credits they have
 * earned (each verified referral permanently raises the free allowance by one,
 * with no cap - see utils/referrals.ts). Paid tiers use their own fixed limits
 * and ignore credits, but the ledger keeps them, so the bonus still applies if
 * the account later returns to Free.
 *
 * `referralCredits` is the SUM of the append-only referral_credits ledger for
 * the user (0 when omitted, preserving the previous behaviour).
 */
export function monthlyCertificateLimit(
  plan: string | null | undefined,
  freeCredentialsPerMonth: number,
  referralCredits = 0
): number | null {
  const tier = paidTierOf(plan);
  if (tier) return TIER_CERTIFICATE_LIMITS[tier];
  const bonus = Number.isFinite(referralCredits) && referralCredits > 0 ? Math.floor(referralCredits) : 0;
  return freeCredentialsPerMonth + bonus;
}

/**
 * Maps a Stripe product name to a tier. Fallback for price ids that are not
 * wired into the STRIPE_PRICE_* env vars (and for retired plan names, which are
 * grandfathered as unlimited Pro).
 */
export function tierFromProductName(name: string): PaidPlanTier | null {
  switch (name.trim().toLowerCase()) {
    case 'starter':
      return 'starter';
    case 'pro':
      return 'pro';
    case 'pro yearly':
      return 'pro_yearly';
    case 'basic':
    case 'most popular':
    case 'professional':
    case 'premium':
      return 'pro_yearly';
    default:
      return null;
  }
}

/** Billing period selected by the pricing toggle. */
export type BillingPeriod = 'monthly' | 'yearly';

/** A purchasable price behind one pricing card. */
export type PlanCheckout = {
  /** `startCheckout` allowlist key (app/subscribe/actions.ts PRICE_ENV). */
  key: string;
  /** Amount in major currency units (euros). */
  amount: number;
  period: 'month' | 'year';
  /** Percentage saved vs. paying monthly for 12 months (Pro yearly only). */
  savingsPercent?: number;
};

export type PricingPlan = {
  id: 'free' | 'starter' | 'pro';
  name: string;
  tagline: string;
  sub: string;
  popular: boolean;
  /** Certificate-allowance bullet; differs by period for Pro (yearly = unlimited). */
  quota: { monthly: string; yearly: string };
  /** Remaining feature bullets (the quota bullet is rendered first). */
  features: string[];
  /** Monthly price; null for Free (no checkout). */
  monthly: PlanCheckout | null;
  /** Yearly price; only Pro offers one. */
  yearly: PlanCheckout | null;
};

/**
 * The three tiers shown on the landing page and /subscribe. Prices are in
 * euros. Pro yearly is €49.99/year vs €9.99/month (€119.88 for 12 months),
 * i.e. a 58% saving, and includes unlimited certificates.
 */
export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Free forever',
    sub: 'Turn any YouTube video into a verifiable credential at no cost.',
    popular: false,
    quota: { monthly: '1 certificate per month', yearly: '1 certificate per month' },
    features: [
      'AI-generated assessments for any video',
      'Progress-tracking learning player',
      'Public verification pages + QR codes',
    ],
    monthly: null,
    yearly: null,
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For steady learners',
    sub: 'Everything in Free, with room to earn every week.',
    popular: false,
    quota: { monthly: '10 certificates per month', yearly: '10 certificates per month' },
    features: ['Everything in Free', 'Cancel anytime from settings'],
    monthly: { key: 'starter', amount: 4.99, period: 'month' },
    yearly: null,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Everything, unlimited',
    sub: '30 certificates a month, or unlimited on yearly billing.',
    popular: true,
    quota: { monthly: '30 certificates per month', yearly: 'Unlimited certificates' },
    features: ['Everything in Starter', 'Best value with yearly billing'],
    monthly: { key: 'pro', amount: 9.99, period: 'month' },
    yearly: { key: 'pro_yearly', amount: 49.99, period: 'year', savingsPercent: 58 },
  },
];

/** Selected price for a plan under the current billing period. */
export function activeCheckout(plan: PricingPlan, period: BillingPeriod): PlanCheckout | null {
  if (period === 'yearly' && plan.yearly) return plan.yearly;
  return plan.monthly;
}

/** Currency formatter for the pricing UI (whole euros drop the decimals). */
export function formatEuro(amount: number): string {
  return `€${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
