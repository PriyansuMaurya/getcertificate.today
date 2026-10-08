import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  REFERRAL_ALPHABET,
  canAttributeReferral,
  generateReferralCode,
  hasVerifiedEmail,
  normalizeReferralCode,
  referralUrl,
} from '../lib/referral-code';

describe('normalizeReferralCode', () => {
  it('trims, uppercases, and accepts the canonical shape', () => {
    assert.equal(normalizeReferralCode('  abc123 '), 'ABC123');
    assert.equal(normalizeReferralCode('ABCD2345'), 'ABCD2345');
  });

  it('rejects non-strings, empty values, and out-of-range lengths', () => {
    assert.equal(normalizeReferralCode(null), null);
    assert.equal(normalizeReferralCode(undefined), null);
    assert.equal(normalizeReferralCode(12345), null);
    assert.equal(normalizeReferralCode(''), null);
    assert.equal(normalizeReferralCode('AB12'), null); // too short
    assert.equal(normalizeReferralCode('A'.repeat(13)), null); // too long
  });

  it('rejects codes containing non-alphanumeric characters', () => {
    assert.equal(normalizeReferralCode('ABC-123'), null);
    assert.equal(normalizeReferralCode('ABC 123'), null);
    assert.equal(normalizeReferralCode('ABC_123'), null);
  });
});

describe('canAttributeReferral', () => {
  const base = {
    referrerId: 'user-a',
    referrerEmail: 'ada@example.com',
    referredUserId: 'user-b',
    referredEmail: 'ben@example.com',
  };

  it('allows a genuine referral between two different accounts', () => {
    assert.equal(canAttributeReferral(base), true);
  });

  it('blocks a user referring themselves by id', () => {
    assert.equal(
      canAttributeReferral({ ...base, referrerId: 'user-b', referredUserId: 'user-b' }),
      false
    );
  });

  it('blocks same-email self-referral regardless of case', () => {
    assert.equal(
      canAttributeReferral({
        ...base,
        referrerEmail: 'Ben@Example.com',
        referredEmail: 'ben@example.com',
      }),
      false
    );
  });

  it('is not fooled by surrounding whitespace', () => {
    assert.equal(
      canAttributeReferral({
        ...base,
        referrerEmail: ' ben@example.com ',
        referredEmail: 'ben@example.com',
      }),
      false
    );
  });

  it('requires both ids to be present', () => {
    assert.equal(canAttributeReferral({ ...base, referrerId: null }), false);
    assert.equal(canAttributeReferral({ ...base, referredUserId: undefined }), false);
  });

  it('still allows the referral when emails are unavailable', () => {
    assert.equal(canAttributeReferral({ ...base, referrerEmail: null, referredEmail: null }), true);
  });
});

describe('hasVerifiedEmail', () => {
  it('treats a Supabase-confirmed address as verified', () => {
    assert.equal(hasVerifiedEmail({ email_confirmed_at: '2026-01-01T00:00:00Z' }), true);
  });

  it('treats an OAuth account as verified even without email_confirmed_at', () => {
    // Google/GitHub assert the address - these signups never hit the email
    // confirmation flow, so the referral settlement must not depend on it.
    assert.equal(
      hasVerifiedEmail({ email_confirmed_at: null, identities: [{ provider: 'google' }] }),
      true
    );
    assert.equal(hasVerifiedEmail({ identities: [{ provider: 'github' }] }), true);
  });

  it('treats an unconfirmed password account as unverified', () => {
    assert.equal(
      hasVerifiedEmail({ email_confirmed_at: null, identities: [{ provider: 'email' }] }),
      false
    );
    assert.equal(hasVerifiedEmail({}), false);
    assert.equal(hasVerifiedEmail({ identities: [] }), false);
    assert.equal(hasVerifiedEmail({ identities: null }), false);
  });

  it('ignores identities with a missing or null provider', () => {
    assert.equal(hasVerifiedEmail({ identities: [{ provider: null }, {}] }), false);
  });

  it('prefers confirmation when both signals are present', () => {
    assert.equal(
      hasVerifiedEmail({
        email_confirmed_at: '2026-01-01T00:00:00Z',
        identities: [{ provider: 'email' }],
      }),
      true
    );
  });
});

describe('referralUrl', () => {
  it('builds an absolute /ref/<code> URL from a base', () => {
    assert.equal(
      referralUrl('ABC123', 'https://getcertificate.today'),
      'https://getcertificate.today/ref/ABC123'
    );
  });

  it('handles a base with a subpath', () => {
    assert.equal(
      referralUrl('ABCD2345', 'http://localhost:3000'),
      'http://localhost:3000/ref/ABCD2345'
    );
  });
});

describe('generateReferralCode', () => {
  it('always produces an 8-char code drawn from the alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      assert.equal(code.length, 8);
      for (const ch of code) {
        assert.ok(REFERRAL_ALPHABET.includes(ch), `unexpected character ${ch} in ${code}`);
      }
      // Round-trips through the validator the route/actions use.
      assert.equal(normalizeReferralCode(code), code);
    }
  });
});

describe('REFERRAL_ALPHABET', () => {
  it('excludes visually ambiguous characters', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L']) {
      assert.equal(REFERRAL_ALPHABET.includes(ch), false, `expected ${ch} to be excluded`);
    }
  });
});
