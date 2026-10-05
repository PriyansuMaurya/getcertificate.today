// Credential integrity (RULES §18). Hashes are computed server-side over a
// canonical serialization of immutable credential fields with a versioned
// `sha256-v1:` prefix so old credentials stay verifiable if the scheme changes.
//
// SERVER ONLY.
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SelectCredential } from '@/utils/db/schema';

export const HASH_VERSION = 'sha256-v1';

// --- Defaults for runtime-tunable settings (utils/settings.ts, edited at
// /admin/settings). Runtime call sites read the live values via getSettings();
// these constants are the fallback when no app_settings row exists and the
// seed defaults, so they must stay in sync with the schema defaults.
export const PASS_SCORE = 70; // PRD §14.1 proposal (recorded in MEMORY.md)
export const MAX_ATTEMPTS_PER_WINDOW = 3;
export const FREE_CREDENTIALS_PER_MONTH = 1; // FR-B6

// Fixed policy constants (not admin-tunable).
export const ATTEMPT_COOLDOWN_DAYS = 7;
export const UNLOCK_PERCENT = 80; // landing-copy completion gate (FR-C5)

/**
 * Canonical serialization of the credential's immutable fields.
 * Field order and separators are part of the scheme - changing them requires
 * a new HASH_VERSION (RULES §18.6).
 */
export function canonicalizeCredential(cred: {
  id: string;
  user_id: string;
  learning_item_id: string;
  attempt_id: string;
  holder_name: string;
  item_title: string;
  score: number;
  passed_at: Date | string;
}): string {
  const passedAt =
    cred.passed_at instanceof Date
      ? cred.passed_at.toISOString()
      : new Date(cred.passed_at).toISOString();
  return [
    `id=${cred.id}`,
    `user=${cred.user_id}`,
    `item=${cred.learning_item_id}`,
    `attempt=${cred.attempt_id}`,
    `holder=${cred.holder_name}`,
    `title=${cred.item_title}`,
    `score=${cred.score}`,
    `passed_at=${passedAt}`,
  ].join('|');
}

/** Compute `sha256-v1:<hex>` over the canonical credential fields. */
export function computeCredentialHash(cred: Parameters<typeof canonicalizeCredential>[0]): string {
  const digest = createHash('sha256').update(canonicalizeCredential(cred), 'utf8').digest('hex');
  return `${HASH_VERSION}:${digest}`;
}

/**
 * Recompute and compare against the stored hash. Constant-time comparison.
 * Returns false on any mismatch (tampering, wrong version prefix).
 */
export function verifyCredentialHash(cred: SelectCredential): boolean {
  const expected = cred.hash;
  if (!expected.startsWith(`${HASH_VERSION}:`)) return false;
  const actual = computeCredentialHash(cred);
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
  } catch {
    return false;
  }
}

/** Credential IDs are server-generated, cryptographically random, URL-safe. */
export function newCredentialId(): string {
  return randomUUID();
}

/** Start of the rolling attempt window (now - cooldown), used by render + actions. */
export function attemptWindowCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - ATTEMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
}

/** Calendar-month UTC quota window start (PRD §14.5 proposal). */
export function monthWindowStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Free plan quota check: at most `freeCredentialsPerMonth` credentials per
 * calendar month (UTC). `plan` is 'none' for free users (existing sentinel);
 * any other value is a Stripe subscription ID and counts as Professional until
 * the webhook resets it. The limit defaults to the static constant but callers
 * pass the live value from getSettings().
 */
export function hasFreeQuotaRemaining(
  credsThisMonth: number,
  plan: string | null,
  freeCredentialsPerMonth: number = FREE_CREDENTIALS_PER_MONTH
): boolean {
  if (plan && plan !== 'none') return true; // Professional: unlimited
  return credsThisMonth < freeCredentialsPerMonth;
}
