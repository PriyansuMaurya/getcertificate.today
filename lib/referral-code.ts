// Pure referral-code helpers shared by the attribution route (/ref/[code]),
// the auth actions, the dashboard, and unit tests.
//
// Deliberately free of server-only imports (no next/headers, no DB, no
// node:crypto): the DB-touching work lives in utils/referrals.ts, and this
// module must stay importable from anywhere (mirrors lib/safe-next.ts).

// Unambiguous alphabet: no 0/O, 1/I/L - people read and type these codes.
export const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Codes are always stored and compared uppercase. The DB default issues
// 8-char uppercase hex codes (md5) for rows inserted outside the app; app-side
// codes use the alphabet above. Both match this shape.
export const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_RE = /^[A-Z0-9]{6,12}$/;

/**
 * Normalize user input into a canonical code, or null when it is not a
 * plausible referral code. Trims and uppercases so `/ref/abc123` behaves the
 * same as `/ref/ABC123`. Never throws - every caller treats null as "no
 * referral".
 */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_RE.test(code) ? code : null;
}

/**
 * Generate one code from REFERRAL_ALPHABET using the platform CSPRNG.
 * Uniqueness is enforced by the caller's probe + the DB unique constraint.
 */
export function generateReferralCode(): string {
  // Use the CSPRNG (a global in both Node 18+ and browsers) rather than
  // Math.random, so codes cannot be predicted or enumerated. This keeps the
  // module free of server-only imports (see the file header).
  const bytes = new Uint32Array(REFERRAL_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_ALPHABET[bytes[i]! % REFERRAL_ALPHABET.length];
  }
  return code;
}

/**
 * Whether a referral may be attributed. Pure guard mirroring the DB CHECK and
 * unique indexes: a user can never refer themselves, and a referrer whose email
 * matches the referred account's email is treated as the same person (the
 * second line of defence for multi-account self-referral).
 */
export function canAttributeReferral(params: {
  referrerId: string | null | undefined;
  referrerEmail: string | null | undefined;
  referredUserId: string | null | undefined;
  referredEmail: string | null | undefined;
}): boolean {
  const { referrerId, referrerEmail, referredUserId, referredEmail } = params;
  if (!referrerId || !referredUserId) return false;
  if (referrerId === referredUserId) return false;
  const a = referrerEmail?.trim().toLowerCase();
  const b = referredEmail?.trim().toLowerCase();
  if (a && b && a === b) return false;
  return true;
}

/** Absolute, shareable referral URL, e.g. https://example.com/ref/ABC123. */
export function referralUrl(code: string, baseUrl: string): string {
  return new URL(`/ref/${code}`, baseUrl).toString();
}

/**
 * Whether an account can be treated as email-verified for referral settlement.
 *
 * True when Supabase marked the address confirmed, OR when the account signed
 * in through an OAuth provider (Google/GitHub) - the provider asserts the
 * address, so those accounts never traverse the email-confirmation flow that
 * would otherwise settle their referral. This is the shared definition of
 * "verified" used by every settlement trigger (OAuth callback,
 * completeOnboarding, loginUser, finishGoogleSignIn), so OAuth-referred users
 * are awarded exactly like password users who click the confirmation link. A
 * password account whose address is unconfirmed stays false until it confirms.
 */
export function hasVerifiedEmail(user: {
  email_confirmed_at?: string | null;
  identities?: { provider?: string | null }[] | null;
}): boolean {
  if (user.email_confirmed_at) return true;
  return (user.identities ?? []).some(
    (identity) => typeof identity.provider === 'string' && identity.provider !== 'email'
  );
}
