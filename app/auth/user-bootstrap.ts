import type { User } from '@supabase/supabase-js';
import { createStripeCustomer } from '@/utils/stripe/api';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';

// Same rule completeOnboarding enforces: 3-20 chars, lowercase letters,
// numbers, underscores.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type ProfileDefaults = {
  firstName?: string;
  lastName?: string;
  username?: string;
};

/** Coerce a metadata value to a trimmed non-empty string, or undefined. */
function metaString(meta: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/** Normalize a raw candidate into the onboarding username format, or null. */
function toUsernameCandidate(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return USERNAME_RE.test(cleaned) ? cleaned : null;
}

/**
 * Find an unused username for this new user, trying numeric suffixes when the
 * preferred candidate is already taken (usernames are globally unique).
 * Returns null when nothing in the bounded search is free — the onboarding
 * form then asks the user to pick one, same as before.
 */
async function pickAvailableUsername(candidate: string | null): Promise<string | null> {
  if (!candidate) return null;
  for (let i = 1; i <= 10; i++) {
    const attempt = i === 1 ? candidate : `${candidate.slice(0, 17)}_${i}`;
    const taken = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, attempt));
    if (taken.length === 0) {
      return attempt;
    }
  }
  return null;
}

/**
 * Derive onboarding profile defaults (first name, last name, username) from
 * OAuth user metadata so the onboarding form comes pre-filled after signing
 * up with Google or GitHub.
 *
 * - Google exposes `given_name`/`family_name` (plus a combined `name`).
 * - GitHub exposes only one display name (`full_name`/`name`) and a login
 *   (`user_name`), so the display name is split with the last word as surname.
 *
 * DOB is never returned by either provider's standard sign-in scopes, so it
 * is deliberately left unset — users still pass through onboarding to enter
 * it (see hasCompletedOnboarding).
 */
function deriveProfileDefaults(user: User): ProfileDefaults {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  let firstName = metaString(meta, 'given_name');
  let lastName = metaString(meta, 'family_name');

  const displayName = metaString(meta, 'full_name', 'name');
  if (displayName && (!firstName || !lastName)) {
    const parts = displayName.split(/\s+/);
    if (!firstName) firstName = parts[0];
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ');
  }
  // GitHub profiles often have no display name at all — fall back to the
  // provider login so first name still arrives pre-filled.
  if (!firstName) {
    firstName = metaString(meta, 'user_name', 'login');
  }

  // Preferred username source: provider login (GitHub), else email local-part
  // (Google sign-in has no login), else a first_last mash-up.
  const username =
    toUsernameCandidate(metaString(meta, 'user_name', 'login')) ??
    toUsernameCandidate(user.email?.split('@')[0]) ??
    toUsernameCandidate(firstName && lastName ? `${firstName}_${lastName}` : firstName);

  return { firstName, lastName, username: username ?? undefined };
}

/**
 * Ensure a local `users` row (and Stripe customer) exists for an OAuth user.
 *
 * Shared by the redirect-based OAuth callback (`app/auth/callback/route.ts`)
 * and the Google Identity Services flow (`finishGoogleSignIn` in
 * `app/auth/actions.ts`), which perform the exact same bootstrap after the
 * Supabase session has been established.
 *
 * New rows are seeded with first name, last name, and a unique username
 * derived from the provider profile so onboarding arrives pre-filled.
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
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const displayName: string =
      metaString(meta, 'full_name', 'user_name', 'name') || email.split('@')[0];

    const defaults = deriveProfileDefaults(user);
    const username = await pickAvailableUsername(defaults.username ?? null);

    stripeID = await createStripeCustomer(user.id, email, displayName);
    await db.insert(usersTable).values({
      id: user.id,
      name: displayName,
      email,
      stripe_id: stripeID,
      plan: 'none',
      // Nullable columns: omitted/undefined stays NULL and the user fills the
      // gap during onboarding.
      username: username ?? undefined,
      first_name: defaults.firstName,
      last_name: defaults.lastName,
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
