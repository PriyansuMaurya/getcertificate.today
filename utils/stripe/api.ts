import { Stripe } from 'stripe';
import { db } from '../db/db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { tierFromProductName, type PaidPlanTier } from '@/utils/plans';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

/**
 * Maps a Stripe price id to its plan tier using the STRIPE_PRICE_* env wiring
 * (the same ids behind the /subscribe checkout buttons). Returns null when the
 * price is not one of ours.
 */
export function tierFromPriceId(priceId: string): PaidPlanTier | null {
  if (!priceId) return null;
  const entries: [string | undefined, PaidPlanTier][] = [
    [process.env.STRIPE_PRICE_STARTER, 'starter'],
    [process.env.STRIPE_PRICE_PRO, 'pro'],
    [process.env.STRIPE_PRICE_PRO_YEARLY, 'pro_yearly'],
  ];
  for (const [id, tier] of entries) {
    if (id && id === priceId) return tier;
  }
  return null;
}

/**
 * Resolves the plan tier stored in `users_table.plan` for a Stripe subscription.
 * Price-id env wiring is checked first; the product name is the fallback (covers
 * price ids that are not present in env, and retired plan names, which map to
 * unlimited Pro). Returns null when nothing can be resolved - the webhook then
 * leaves the stored plan untouched rather than downgrading a live subscriber.
 */
export async function resolveSubscriptionTier(
  subscription: Stripe.Subscription
): Promise<PaidPlanTier | null> {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  if (priceId) {
    const byPrice = tierFromPriceId(priceId);
    if (byPrice) return byPrice;
  }
  const productId = item?.price?.product;
  if (typeof productId === 'string') {
    try {
      const product = await stripe.products.retrieve(productId);
      return tierFromProductName(product.name);
    } catch (err) {
      console.error(
        '[stripe] product lookup failed:',
        err instanceof Error ? err.message : 'unknown error'
      );
    }
  }
  return null;
}

export async function createStripeCustomer(id: string, email: string, name?: string) {
  const customer = await stripe.customers.create({
    name: name ? name : '',
    email: email,
    metadata: {
      supabase_id: id,
    },
  });
  // Create a new customer in Stripe
  return customer.id;
}

export async function generateStripeBillingPortalLink(email: string) {
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const account = rows[0];
  if (!account) {
    // No account row means there is nothing to bill; fail with a clear message
    // instead of throwing on an undefined row (callers treat this as "no
    // billing portal available yet").
    throw new Error('Cannot create a billing portal link: no account for this email.');
  }
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: account.stripe_id,
    return_url: `${PUBLIC_URL}/dashboard`,
  });
  return portalSession.url;
}
