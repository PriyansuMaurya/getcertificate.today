import type { User } from '@supabase/supabase-js';
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
 * Returns null when nothing in the bounded search is free - the onboarding
 * form then asks the user to pick one, same as before.
 */
export async function pickAvailableUsername(candidate: string | null): Promise<string | null> {
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
 * is deliberately left unset - users still pass through onboarding to enter
 * it (see hasCompletedOnboarding).
 */
export function deriveProfileDefaults(user: User): ProfileDefaults {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;

  let firstName = metaString(meta, 'given_name');
  let lastName = metaString(meta, 'family_name');

  const displayName = metaString(meta, 'full_name', 'name');
  if (displayName && (!firstName || !lastName)) {
    const parts = displayName.split(/\s+/);
    if (!firstName) firstName = parts[0];
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ');
  }
  // GitHub profiles often have no display name at all - fall back to the
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
 * Validate an OAuth user before they are routed to onboarding/dashboard.
 *
 * Shared by the redirect-based OAuth callback (`app/auth/callback/route.ts`)
 * and the Google Identity Services flow (`finishGoogleSignIn` in
 * `app/auth/actions.ts`), which run after the Supabase session has been
 * established.
 *
 * Deliberately writes NOTHING: the local `users` row (and its Stripe
 * customer) is created by `completeOnboarding` only once every detail -
 * username, first/last name and DOB - has been supplied, so a sign-in that is
 * abandoned before onboarding leaves no partial user behind. Profile defaults
 * for the onboarding form are derived on the fly from provider metadata via
 * `deriveProfileDefaults` (see `app/onboarding/page.tsx`).
 *
 * Returns `{ ok: false }` when the account has no email address (required
 * later for the users row and Stripe customer) so callers can route to the
 * designed error page instead of surfacing a raw 500. This function must
 * never call `redirect()` itself - callers own the navigation.
 */
export async function bootstrapOAuthUser(user: User): Promise<{ ok: boolean }> {
  return { ok: Boolean(user.email) };
}
