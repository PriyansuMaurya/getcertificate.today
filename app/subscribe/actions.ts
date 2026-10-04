'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/utils/stripe/api';

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

const PRICE_ENV: Record<string, string> = {
  basic: 'STRIPE_PRICE_BASIC',
  popular: 'STRIPE_PRICE_POPULAR',
  premium: 'STRIPE_PRICE_PREMIUM',
};

export type PlanKey = keyof typeof PRICE_ENV;

export async function startCheckout(planKey: string) {
  // Allowlist check: `planKey` arrives from the client, so only the three
  // known plan keys are ever resolved - an arbitrary key can never reach
  // process.env indexing or Stripe.
  const priceEnvKey = Object.prototype.hasOwnProperty.call(PRICE_ENV, planKey)
    ? PRICE_ENV[planKey]
    : undefined;
  const priceId = priceEnvKey ? process.env[priceEnvKey] : undefined;
  if (!priceId) {
    console.error(`startCheckout: missing env ${priceEnvKey ?? 'unknown plan'}`);
    redirect('/subscribe?checkout=unavailable');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const rows = await db
    .select({ stripe_id: usersTable.stripe_id })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));
  // The users row (created only by completeOnboarding) is what a subscription
  // is recorded against - without it the account has not finished onboarding,
  // so send the user there instead of starting an unattributable checkout.
  if (rows.length === 0) {
    redirect('/onboarding');
  }
  const stripeId = rows[0]?.stripe_id;

  let sessionUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create(
      {
        // Existing customers keep their subscription history; brand-new accounts
        // (or rows without stripe_id) are attached by email instead.
        ...(stripeId
          ? { customer: stripeId }
          : { customer_email: user.email ?? undefined, client_reference_id: user.id }),
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${PUBLIC_URL}/subscribe?checkout=success`,
        cancel_url: `${PUBLIC_URL}/subscribe?checkout=canceled`,
      },
      {
        // Guard against Stripe's default long retry window stretching a single
        // click past typical proxy timeouts on slow networks. The idempotency
        // key dedupes double-submits (double click, network retry) so only one
        // checkout session is ever created per user+plan click. The 1-minute
        // time bucket keeps dedupe scoped to an actual double-submit: Stripe
        // replays the same response for a repeated key for 24h, so a static
        // key would hand back a stale session to a user who returns later.
        timeout: 15_000,
        maxNetworkRetries: 2,
        idempotencyKey: `checkout:${user.id}:${planKey}:${Math.floor(Date.now() / 60_000)}`,
      }
    );
    sessionUrl = session.url;
  } catch (err) {
    // Stripe failure (bad price, config, network) must reach the designed
    // fallback banner, not surface as a raw 500.
    console.error('startCheckout failed:', err instanceof Error ? err.message : 'unknown error');
  }

  if (!sessionUrl) {
    redirect('/subscribe?checkout=unavailable');
  }
  // Only ever redirect to the HTTPS URL Stripe returned - never a caller-supplied value.
  if (!sessionUrl.startsWith('https://')) {
    redirect('/subscribe?checkout=unavailable');
  }
  redirect(sessionUrl);
}
