import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PRICING_PLANS,
  TIER_CERTIFICATE_LIMITS,
  activeCheckout,
  formatEuro,
  isPaidPlanTier,
  monthlyCertificateLimit,
  paidTierOf,
  planLabel,
  tierFromProductName,
  type PricingPlan,
} from './plans';

/** Looks up a plan by id, failing the test (not throwing) if it is missing. */
function plan(id: 'free' | 'starter' | 'pro'): PricingPlan {
  const found = PRICING_PLANS.find((p) => p.id === id);
  assert.ok(found, `expected a plan with id "${id}"`);
  return found;
}

describe('paidTierOf', () => {
  it('resolves each known paid tier to itself', () => {
    assert.equal(paidTierOf('starter'), 'starter');
    assert.equal(paidTierOf('pro'), 'pro');
    assert.equal(paidTierOf('pro_yearly'), 'pro_yearly');
  });

  it('treats the free sentinel, null, undefined and empty as free', () => {
    assert.equal(paidTierOf('none'), null);
    assert.equal(paidTierOf(null), null);
    assert.equal(paidTierOf(undefined), null);
    assert.equal(paidTierOf(''), null);
  });

  it('grandfathers legacy Stripe subscription ids as unlimited Pro', () => {
    assert.equal(paidTierOf('sub_abc123'), 'pro_yearly');
    assert.equal(paidTierOf('sub_gct_seed_pro_0001'), 'pro_yearly');
  });

  it('grandfathers retired plan keys as unlimited Pro', () => {
    // Whatever a legacy row holds, any non-'none' value keeps its old unlimited
    // entitlement (utils/plans.ts comment).
    assert.equal(paidTierOf('basic'), 'pro_yearly');
    assert.equal(paidTierOf('popular'), 'pro_yearly');
    assert.equal(paidTierOf('premium'), 'pro_yearly');
  });

  it('grandfathers any other unknown non-"none" value (values are server-written)', () => {
    // Not case-normalized on purpose: only the webhook writes this column.
    assert.equal(paidTierOf('Starter'), 'pro_yearly');
    assert.equal(paidTierOf('paid'), 'pro_yearly');
  });
});

describe('planLabel', () => {
  it('labels the free sentinel as Free', () => {
    assert.equal(planLabel('none'), 'Free');
    assert.equal(planLabel(null), 'Free');
    assert.equal(planLabel(undefined), 'Free');
  });

  it('labels Starter distinctly', () => {
    assert.equal(planLabel('starter'), 'Starter');
  });

  it('labels both Pro tiers (and grandfathered accounts) as Pro', () => {
    assert.equal(planLabel('pro'), 'Pro');
    assert.equal(planLabel('pro_yearly'), 'Pro');
    assert.equal(planLabel('sub_legacy_123'), 'Pro');
    assert.equal(planLabel('premium'), 'Pro');
  });
});

describe('monthlyCertificateLimit', () => {
  it('returns the fixed tier limits (Starter 10, Pro 30)', () => {
    assert.equal(monthlyCertificateLimit('starter', 1), 10);
    assert.equal(monthlyCertificateLimit('pro', 1), 30);
  });

  it('returns null (unlimited) for Pro yearly and grandfathered accounts', () => {
    assert.equal(monthlyCertificateLimit('pro_yearly', 1), null);
    assert.equal(monthlyCertificateLimit('sub_legacy_123', 1), null);
  });

  it('returns the configured free allowance for free accounts', () => {
    assert.equal(monthlyCertificateLimit('none', 1), 1);
    assert.equal(monthlyCertificateLimit(null, 5), 5);
    assert.equal(monthlyCertificateLimit('none', 0), 0);
  });

  it('ignores the free allowance for paid tiers', () => {
    assert.equal(monthlyCertificateLimit('starter', 99), 10);
    assert.equal(monthlyCertificateLimit('pro', 99), 30);
  });
});

describe('tierFromProductName', () => {
  it('maps the current product names', () => {
    assert.equal(tierFromProductName('Starter'), 'starter');
    assert.equal(tierFromProductName('Pro'), 'pro');
    assert.equal(tierFromProductName('Pro Yearly'), 'pro_yearly');
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    assert.equal(tierFromProductName('starter'), 'starter');
    assert.equal(tierFromProductName('  PRO  '), 'pro');
    assert.equal(tierFromProductName('pro yearly'), 'pro_yearly');
    assert.equal(tierFromProductName('PRO YEARLY'), 'pro_yearly');
  });

  it('grandfathers retired product names as unlimited Pro', () => {
    assert.equal(tierFromProductName('Basic'), 'pro_yearly');
    assert.equal(tierFromProductName('Most Popular'), 'pro_yearly');
    assert.equal(tierFromProductName('Professional'), 'pro_yearly');
    assert.equal(tierFromProductName('Premium'), 'pro_yearly');
  });

  it('returns null for unknown or empty names', () => {
    assert.equal(tierFromProductName('Something Else'), null);
    assert.equal(tierFromProductName(''), null);
    assert.equal(tierFromProductName('   '), null);
  });
});

describe('activeCheckout', () => {
  it('returns no checkout for the Free plan in either period', () => {
    assert.equal(activeCheckout(plan('free'), 'monthly'), null);
    assert.equal(activeCheckout(plan('free'), 'yearly'), null);
  });

  it('returns the monthly price for Starter (no yearly option)', () => {
    assert.equal(activeCheckout(plan('starter'), 'monthly')?.key, 'starter');
    // Yearly selected but Starter has no yearly price -> falls back to monthly.
    assert.equal(activeCheckout(plan('starter'), 'yearly')?.key, 'starter');
    assert.equal(activeCheckout(plan('starter'), 'yearly')?.period, 'month');
  });

  it('returns the yearly price for Pro when yearly is selected', () => {
    assert.equal(activeCheckout(plan('pro'), 'monthly')?.key, 'pro');
    assert.equal(activeCheckout(plan('pro'), 'yearly')?.key, 'pro_yearly');
    assert.equal(activeCheckout(plan('pro'), 'yearly')?.period, 'year');
  });

  it('falls back to monthly for Pro when no yearly price exists', () => {
    const noYearly: PricingPlan = { ...plan('pro'), yearly: null };
    assert.equal(activeCheckout(noYearly, 'yearly')?.key, 'pro');
  });
});

describe('isPaidPlanTier', () => {
  it('accepts only the three known tier keys', () => {
    assert.equal(isPaidPlanTier('starter'), true);
    assert.equal(isPaidPlanTier('pro'), true);
    assert.equal(isPaidPlanTier('pro_yearly'), true);
  });

  it('rejects the free sentinel, legacy values and non-strings', () => {
    assert.equal(isPaidPlanTier('none'), false);
    assert.equal(isPaidPlanTier('sub_abc123'), false);
    assert.equal(isPaidPlanTier(''), false);
    assert.equal(isPaidPlanTier(null), false);
    assert.equal(isPaidPlanTier(undefined), false);
    assert.equal(isPaidPlanTier(1), false);
  });
});

describe('formatEuro', () => {
  it('renders whole amounts without decimals', () => {
    assert.equal(formatEuro(0), '€0');
    assert.equal(formatEuro(9), '€9');
  });

  it('renders cents with two decimals', () => {
    assert.equal(formatEuro(4.99), '€4.99');
    assert.equal(formatEuro(9.99), '€9.99');
    assert.equal(formatEuro(49.99), '€49.99');
  });
});

describe('PRICING_PLANS', () => {
  it('exposes exactly the Free, Starter and Pro tiers', () => {
    assert.deepEqual(
      PRICING_PLANS.map((p) => p.id),
      ['free', 'starter', 'pro']
    );
  });

  it('prices the tiers in euros as specified', () => {
    assert.equal(plan('free').monthly, null);
    assert.equal(plan('starter').monthly?.amount, 4.99);
    assert.equal(plan('pro').monthly?.amount, 9.99);
    assert.equal(plan('pro').yearly?.amount, 49.99);
    assert.equal(plan('pro').yearly?.period, 'year');
  });

  it('gives only Pro a yearly option, with a consistent savings claim', () => {
    assert.equal(plan('free').yearly, null);
    assert.equal(plan('starter').yearly, null);
    const pro = plan('pro');
    const yearly = pro.yearly;
    assert.ok(yearly);
    const monthlyForYear = (pro.monthly?.amount ?? 0) * 12;
    const actual = Math.round((1 - yearly.amount / monthlyForYear) * 100);
    assert.equal(yearly.savingsPercent, actual);
    assert.equal(yearly.savingsPercent, 58);
  });

  it('marks only Pro as popular and gives it the unlimited yearly quota', () => {
    assert.equal(plan('free').popular, false);
    assert.equal(plan('starter').popular, false);
    assert.equal(plan('pro').popular, true);
    assert.equal(plan('pro').quota.yearly, 'Unlimited certificates');
  });

  it('keeps the tier certificate limits in sync with the plan copy', () => {
    assert.deepEqual(TIER_CERTIFICATE_LIMITS, { starter: 10, pro: 30, pro_yearly: null });
    assert.match(plan('starter').quota.monthly, /10 certificates/);
    assert.match(plan('pro').quota.monthly, /30 certificates/);
  });
});
