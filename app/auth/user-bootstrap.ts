import type { User } from '@supabase/supabase-js';
import { createStripeCustomer } from '@/utils/stripe/api';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Ensure a local `users` row (and Stripe customer) exists for an OAuth user.
 *
 * Shared by the redirect-based OAuth callback (`app/auth/callback/route.ts`)
 * and the Google Identity Services flow (`finishGoogleSignIn` in
 * `app/auth/actions.ts`), which perform the exact same bootstrap after the
 * Supabase session has been established.
 *
 * Returns `{ ok: false }` on any failure so callers can route the user to the
 * designed error page instead of surfacing a raw 500. This function must never
 * call `redirect()` itself — callers own the navigation.
 */
export async function bootstrapOAuthUser(user: User): Promise<{ ok: boolean }> {
  const email = user.email;
  if (!email) {
    return { ok: false };
  }

  let stripeID: string | undefined;
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));
    if (existing.length > 0) {
      return { ok: true };
    }

    // `users.name` is NOT NULL and GitHub profiles often have no display name
    // (full_name: null), so fall back to the GitHub username, then to the
    // email local-part, before writing the row.
    const meta = user.user_metadata ?? {};
    const displayName: string = meta.full_name || meta.user_name || email.split('@')[0];

    stripeID = await createStripeCustomer(user.id, email, displayName);
    await db.insert(usersTable).values({
      id: user.id,
      name: displayName,
      email,
      stripe_id: stripeID,
      plan: 'none',
    });
    return { ok: true };
  } catch (err) {
    // A Stripe/DB failure here would otherwise surface as a raw 500; log it
    // (including any created stripe_id, so a retry doesn't silently mint a
    // duplicate Stripe customer with no trace) and let the caller redirect to
    // the designed error page instead.
    console.error(
      'OAuth user bootstrap failed:',
      stripeID ? `stripe customer created (id=${stripeID})` : 'stripe customer not created',
      '|',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return { ok: false };
  }
}
