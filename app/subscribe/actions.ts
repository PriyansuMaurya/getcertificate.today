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
  const priceId = PRICE_ENV[planKey] ? process.env[PRICE_ENV[planKey]] : undefined;
  if (!priceId) {
    console.error(`startCheckout: missing env ${PRICE_ENV[planKey] ?? planKey}`);
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
  const stripeId = rows[0]?.stripe_id;

  let sessionUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      // Existing customers keep their subscription history; brand-new accounts
      // (or rows without stripe_id) are attached by email instead.
      ...(stripeId
        ? { customer: stripeId }
        : { customer_email: user.email ?? undefined, client_reference_id: user.id }),
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${PUBLIC_URL}/subscribe?checkout=success`,
      cancel_url: `${PUBLIC_URL}/subscribe?checkout=canceled`,
    });
    sessionUrl = session.url;
  } catch (err) {
    // Stripe failure (bad price, config, network) must reach the designed
    // fallback banner, not surface as a raw 500.
    console.error('startCheckout failed:', err instanceof Error ? err.message : 'unknown error');
  }

  if (!sessionUrl) {
    redirect('/subscribe?checkout=unavailable');
  }
  redirect(sessionUrl);
}
