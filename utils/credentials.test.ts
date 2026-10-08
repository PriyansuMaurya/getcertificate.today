import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FREE_CREDENTIALS_PER_MONTH,
  hasCredentialQuotaRemaining,
  isAdminAccount,
  monthWindowStart,
} from './credentials';

describe('hasCredentialQuotaRemaining', () => {
  it('defaults the free limit to the static constant (1)', () => {
    assert.equal(FREE_CREDENTIALS_PER_MONTH, 1);
    // Omitted limit argument falls back to the constant.
    assert.equal(hasCredentialQuotaRemaining(0, 'none'), true);
    assert.equal(hasCredentialQuotaRemaining(1, 'none'), false);
  });

  it('allows a free user below the configured limit', () => {
    assert.equal(hasCredentialQuotaRemaining(0, 'none', 1), true);
    assert.equal(hasCredentialQuotaRemaining(2, 'none', 3), true);
  });

  it('blocks a free user at or above the configured limit', () => {
    assert.equal(hasCredentialQuotaRemaining(1, 'none', 1), false);
    assert.equal(hasCredentialQuotaRemaining(5, 'none', 3), false);
  });

  it('treats a null plan as free', () => {
    assert.equal(hasCredentialQuotaRemaining(0, null, 1), true);
    assert.equal(hasCredentialQuotaRemaining(1, null, 1), false);
  });

  it('treats a limit of 0 as no free certificates at all', () => {
    assert.equal(hasCredentialQuotaRemaining(0, 'none', 0), false);
  });

  it('uses the live limit value an admin sets', () => {
    // Same usage, different configured limit -> different outcome.
    assert.equal(hasCredentialQuotaRemaining(3, 'none', 3), false);
    assert.equal(hasCredentialQuotaRemaining(3, 'none', 4), true);
  });

  it('caps Starter at 10 certificates per month', () => {
    assert.equal(hasCredentialQuotaRemaining(9, 'starter', 1), true);
    assert.equal(hasCredentialQuotaRemaining(10, 'starter', 1), false);
  });

  it('caps Pro at 30 certificates per month', () => {
    assert.equal(hasCredentialQuotaRemaining(29, 'pro', 1), true);
    assert.equal(hasCredentialQuotaRemaining(30, 'pro', 1), false);
  });

  it('allows unlimited certificates on Pro yearly', () => {
    assert.equal(hasCredentialQuotaRemaining(999, 'pro_yearly', 1), true);
  });

  it('grandfathers legacy subscription ids as unlimited', () => {
    assert.equal(hasCredentialQuotaRemaining(999, 'sub_abc123', 1), true);
  });

  it('does not grandfather an unexpected plan value (falls back to free)', () => {
    assert.equal(hasCredentialQuotaRemaining(999, 'paid', 1), false);
    assert.equal(hasCredentialQuotaRemaining(0, 'paid', 1), true);
  });

  it('allows admins even with the free sentinel plan and a zero limit', () => {
    assert.equal(hasCredentialQuotaRemaining(0, 'none', 0, true), true);
    assert.equal(hasCredentialQuotaRemaining(10, 'none', 1, true), true);
    assert.equal(hasCredentialQuotaRemaining(999, 'none', 3, true), true);
  });

  it('extends the free allowance by earned referral credits', () => {
    // One base certificate + one referral credit -> one more is allowed.
    assert.equal(hasCredentialQuotaRemaining(1, 'none', 1, false, 1), true);
    assert.equal(hasCredentialQuotaRemaining(2, 'none', 1, false, 1), false);
    // Credits stack without a cap.
    assert.equal(hasCredentialQuotaRemaining(10, 'none', 1, false, 10), true);
    assert.equal(hasCredentialQuotaRemaining(11, 'none', 1, false, 10), false);
    assert.equal(hasCredentialQuotaRemaining(100, 'none', 1, false, 100), true);
    assert.equal(hasCredentialQuotaRemaining(101, 'none', 1, false, 100), false);
  });

  it('defaults referral credits to 0, preserving prior behaviour', () => {
    assert.equal(hasCredentialQuotaRemaining(1, 'none', 1), false);
    assert.equal(hasCredentialQuotaRemaining(1, 'none', 1, false), false);
    assert.equal(hasCredentialQuotaRemaining(1, 'none', 1, false, 0), false);
  });

  it('ignores referral credits on paid tiers (fixed limits)', () => {
    assert.equal(hasCredentialQuotaRemaining(10, 'starter', 1, false, 100), false);
    assert.equal(hasCredentialQuotaRemaining(9, 'starter', 1, false, 100), true);
    assert.equal(hasCredentialQuotaRemaining(999, 'pro_yearly', 1, false, 100), true);
  });

  it('still lets admins bypass everything with credits present', () => {
    assert.equal(hasCredentialQuotaRemaining(999, 'none', 0, true, 3), true);
  });
});

describe('isAdminAccount', () => {
  it('is true only for an admin that is not suspended', () => {
    assert.equal(isAdminAccount('admin', null), true);
  });

  it('is false for a suspended admin (suspension revokes the bypass)', () => {
    assert.equal(isAdminAccount('admin', new Date()), false);
  });

  it('is false for non-admin roles regardless of suspension', () => {
    assert.equal(isAdminAccount('user', null), false);
    assert.equal(isAdminAccount('user', new Date()), false);
  });

  it('is false for a missing account or missing role', () => {
    assert.equal(isAdminAccount(undefined, undefined), false);
    assert.equal(isAdminAccount(null, null), false);
  });

  it('is case-sensitive on the role', () => {
    assert.equal(isAdminAccount('Admin', null), false);
  });

  it('drives the quota bypass: only a non-suspended admin is unlimited', () => {
    assert.equal(hasCredentialQuotaRemaining(5, 'none', 1, isAdminAccount('admin', new Date())), false);
    assert.equal(hasCredentialQuotaRemaining(5, 'none', 1, isAdminAccount('admin', null)), true);
  });
});

describe('monthWindowStart', () => {
  it('returns the first instant of the UTC calendar month', () => {
    assert.equal(
      monthWindowStart(new Date('2026-03-17T13:45:00.000Z')).toISOString(),
      '2026-03-01T00:00:00.000Z'
    );
  });

  it('is stable at month boundaries', () => {
    assert.equal(
      monthWindowStart(new Date('2026-01-01T00:00:00.000Z')).toISOString(),
      '2026-01-01T00:00:00.000Z'
    );
    assert.equal(
      monthWindowStart(new Date('2026-12-31T23:59:59.999Z')).toISOString(),
      '2026-12-01T00:00:00.000Z'
    );
  });
});
