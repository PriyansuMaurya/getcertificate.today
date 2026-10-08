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
 * Generate one code from REFERRAL_ALPHABET. Deliberately not a secret: referral
 * codes are shared publicly, so unpredictability is not a security property
 * here. Uniqueness is enforced by the caller's probe + the DB unique constraint.
 */
export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)];
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
