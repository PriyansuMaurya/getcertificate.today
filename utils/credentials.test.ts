import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FREE_CREDENTIALS_PER_MONTH,
  hasFreeQuotaRemaining,
  isAdminAccount,
  monthWindowStart,
} from './credentials';

describe('hasFreeQuotaRemaining', () => {
  it('defaults the free limit to the static constant (1)', () => {
    assert.equal(FREE_CREDENTIALS_PER_MONTH, 1);
    // Omitted limit argument falls back to the constant.
    assert.equal(hasFreeQuotaRemaining(0, 'none'), true);
    assert.equal(hasFreeQuotaRemaining(1, 'none'), false);
  });

  it('allows a free user below the configured limit', () => {
    assert.equal(hasFreeQuotaRemaining(0, 'none', 1), true);
    assert.equal(hasFreeQuotaRemaining(2, 'none', 3), true);
  });

  it('blocks a free user at or above the configured limit', () => {
    assert.equal(hasFreeQuotaRemaining(1, 'none', 1), false);
    assert.equal(hasFreeQuotaRemaining(5, 'none', 3), false);
  });

  it('treats a null plan as free', () => {
    assert.equal(hasFreeQuotaRemaining(0, null, 1), true);
    assert.equal(hasFreeQuotaRemaining(1, null, 1), false);
  });

  it('treats a limit of 0 as no free certificates at all', () => {
    assert.equal(hasFreeQuotaRemaining(0, 'none', 0), false);
  });

  it('uses the live limit value an admin sets', () => {
    // Same usage, different configured limit -> different outcome.
    assert.equal(hasFreeQuotaRemaining(3, 'none', 3), false);
    assert.equal(hasFreeQuotaRemaining(3, 'none', 4), true);
  });

  it('allows a paid subscriber regardless of usage', () => {
    assert.equal(hasFreeQuotaRemaining(999, 'sub_abc123', 1), true);
  });

  it('allows admins even with the free sentinel plan and a zero limit', () => {
    assert.equal(hasFreeQuotaRemaining(0, 'none', 0, true), true);
    assert.equal(hasFreeQuotaRemaining(10, 'none', 1, true), true);
    assert.equal(hasFreeQuotaRemaining(999, 'none', 3, true), true);
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
    assert.equal(hasFreeQuotaRemaining(5, 'none', 1, isAdminAccount('admin', new Date())), false);
    assert.equal(hasFreeQuotaRemaining(5, 'none', 1, isAdminAccount('admin', null)), true);
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
