// Referral program - server only. Owns every DB touch for referrals: resolving
// a code into an eligible referrer, recording the referral when a new account is
// born, and settling the reward once the referred account confirms their email.
//
// Reward model: when a referred account's email is verified, the referrer earns
// exactly one certificate credit IF they are on the free tier. Credits are
// recorded in the append-only `referral_credits` ledger and folded into the
// existing free-tier quota (utils/credentials.ts) - there is no separate
// balance or mint path. Credits stack without a cap and persist across
// subscription changes; only the free tier consumes them.
//
// Every mutation is atomic and idempotent:
//   * a referral row is unique per referred user/email + onConflictDoNothing;
//   * settlement claims the pending->verified row under an advisory lock, so
//     exactly one concurrent caller wins;
//   * the credit ledger has a unique (referral_id, reason), so a retried
//     settlement cannot double-credit.
//
// NOT a 'use server' module: its exports must stay internal server functions,
// never become public endpoints (same rule as app/auth/onboarding-status.ts).
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/utils/db/db';
import {
  credentialsTable,
  referralCreditsTable,
  referralsTable,
  usersTable,
} from '@/utils/db/schema';
import { monthlyCertificateLimit, paidTierOf } from '@/utils/plans';
import { monthWindowStart } from '@/utils/credentials';
import {
  canAttributeReferral,
  generateReferralCode,
  normalizeReferralCode,
} from '@/lib/referral-code';

export const REFERRAL_CREDIT_REASON = 'referral_verified' as const;
export const REFERRAL_REVERSAL_REASON = 'reversal' as const;

/**
 * SQL aggregate for a user's referral-credit balance. Exported so the mint
 * transactions in app/learn/actions.ts can compute it from their own `tx` (one
 * consistent read inside the same transaction that enforces the quota).
 */
export const referralCreditSum = sql<number>`coalesce(sum(${referralCreditsTable.amount}), 0)::int`;

/**
 * Issue a referral code that is not already taken, or null when a bounded
 * search finds nothing (then the column's DB default is used as a fallback).
 * The unique constraint on users_table.referral_code is the real backstop; this
 * probe just avoids a failed insert in all but the most contrived races.
 */
export async function generateUniqueReferralCode(maxAttempts = 10): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateReferralCode();
    const taken = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referral_code, code));
    if (taken.length === 0) return code;
  }
  return null;
}

export type ReferralAttribution = { referrerId: string; code: string };

/**
 * Resolve a raw code (from auth metadata or the referral cookie) into a
 * referrer that is allowed to refer this account, or null when there is no
 * valid, eligible referrer. Combines the pure eligibility guard
 * (lib/referral-code.ts) with a lookup, so self-referral by id or email is
 * rejected before anything is written.
 */
export async function resolveReferralAttribution(params: {
  rawCode: string | null | undefined;
  referredUserId: string;
  referredEmail: string | null | undefined;
}): Promise<ReferralAttribution | null> {
  const code = normalizeReferralCode(params.rawCode);
  if (!code) return null;

  const rows = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.referral_code, code));

  const referrer = rows[0];
  if (!referrer) return null;

  const allowed = canAttributeReferral({
    referrerId: referrer.id,
    referrerEmail: referrer.email,
    referredUserId: params.referredUserId,
    referredEmail: params.referredEmail,
  });
  if (!allowed) return null;

  return { referrerId: referrer.id, code };
}

/**
 * Record the referral for a freshly created account and bump the referrer's
 * denormalized count in one transaction. Always starts 'pending': verification
 * (and the reward) happen in settleReferralOnVerifiedEmail, so there is a single
 * path that flips status and grants the credit exactly once.
 *
 * Idempotent: the unique indexes on referrals (referred user + email) mean a
 * retry (e.g. a resubmitted onboarding form) inserts nothing, and the count is
 * only incremented when a row was actually inserted.
 */
export async function recordReferralForNewUser(params: {
  referredUserId: string;
  referredEmail: string;
  attribution: ReferralAttribution;
}): Promise<boolean> {
  const email = params.referredEmail.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(referralsTable)
      .values({
        id: randomUUID(),
        referrer_user_id: params.attribution.referrerId,
        referred_user_id: params.referredUserId,
        referred_email: email,
        referral_code: params.attribution.code,
        verification_status: 'pending',
        reward_status: 'none',
      })
      .onConflictDoNothing()
      .returning({ id: referralsTable.id });

    if (inserted.length === 0) return false;

    await tx
      .update(usersTable)
      .set({ referral_count: sql`${usersTable.referral_count} + 1` })
      .where(eq(usersTable.id, params.attribution.referrerId));

    return true;
  });
}

export type ReferralSettlement = {
  /** True when this call moved the referral from pending to verified. */
  settled: boolean;
  /**
   * True when a credit exists for this referral after the call. Because the
   * ledger's unique (referral_id, reason) makes issuance idempotent, this is
   * also true when a +1 row already existed (a prior partial run) - the reward
   * is on the ledger either way.
   */
  awarded: boolean;
};

/**
 * Settle a referred account's referral once its email is verified: mark it
 * verified and, when the referrer is on the free tier, add one certificate
 * credit to the ledger. Retry-safe and idempotent - safe to call on every
 * sign-in and after email confirmation.
 *
 * Concurrency: a per-referred-user advisory lock serializes competing callers,
 * and the settlement is a conditional UPDATE (pending -> verified) that only one
 * transaction can win. The ledger's unique (referral_id, reason) then makes the
 * credit itself exactly-once even if the flow is somehow replayed.
 *
 * If the referrer is on a paid tier, no credit is owed (the request only grants
 * credits on the free tier): the referral is still marked verified, with
 * reward_status 'not_applicable'.
 */
export async function settleReferralOnVerifiedEmail(
  referredUserId: string
): Promise<ReferralSettlement> {
  // Fast path: this runs on every sign-in, so look for a pending referral first
  // and skip the advisory lock entirely for the common case (no referral, or
  // already settled). Only the rare account with something to settle pays for
  // the lock.
  //
  // TOCTOU note: a referral recorded concurrently (just after this SELECT) is
  // not missed - completeOnboarding settles it immediately after recording, and
  // every later sign-in retries the settlement, which is idempotent.
  const pending = await db
    .select({ id: referralsTable.id })
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.referred_user_id, referredUserId),
        eq(referralsTable.verification_status, 'pending')
      )
    );
  if (pending.length === 0) return { settled: false, awarded: false };

  return db.transaction(async (tx) => {
    // Serialize settlements for this referred account (released at commit).
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`referral-settle:${referredUserId}`}))`
    );

    // Single-winner claim. Any earlier settlement already moved the row off
    // 'pending', so a retry returns no row here and awards nothing.
    const claimed = await tx
      .update(referralsTable)
      .set({ verification_status: 'verified', verified_at: new Date() })
      .where(
        and(
          eq(referralsTable.referred_user_id, referredUserId),
          eq(referralsTable.verification_status, 'pending')
        )
      )
      .returning({ id: referralsTable.id, referrerId: referralsTable.referrer_user_id });

    if (claimed.length === 0) return { settled: false, awarded: false };

    const referral = claimed[0];
    const referrerRows = await tx
      .select({ plan: usersTable.plan })
      .from(usersTable)
      .where(eq(usersTable.id, referral.referrerId));

    // Free tier only: paid tiers have their own fixed limits and keep their
    // earned credits in the ledger for a possible return to Free.
    if (paidTierOf(referrerRows[0]?.plan) !== null) {
      await tx
        .update(referralsTable)
        .set({ reward_status: 'not_applicable' })
        .where(eq(referralsTable.id, referral.id));
      return { settled: true, awarded: false };
    }

    // The unique (referral_id, reason) makes this exactly-once: a retried or
    // replayed settlement inserts nothing. Either way a +1 credit now exists on
    // the ledger, so the referral is awarded below.
    await tx
      .insert(referralCreditsTable)
      .values({
        id: randomUUID(),
        user_id: referral.referrerId,
        referral_id: referral.id,
        amount: 1,
        reason: REFERRAL_CREDIT_REASON,
      })
      .onConflictDoNothing();

    await tx
      .update(referralsTable)
      .set({
        reward_status: 'awarded',
        reward_awarded_at: sql`coalesce(${referralsTable.reward_awarded_at}, now())`,
      })
      .where(eq(referralsTable.id, referral.id));

    return { settled: true, awarded: true };
  });
}

/**
 * A user's current referral-credit balance: the SUM of the append-only ledger.
 * This is the value folded into the free-tier quota - there is no stored
 * mutable balance to drift. Returns 0 when the user has no entries.
 */
export async function getReferralCreditBalance(userId: string): Promise<number> {
  const rows = await db
    .select({ total: referralCreditSum })
    .from(referralCreditsTable)
    .where(eq(referralCreditsTable.user_id, userId));
  return rows[0]?.total ?? 0;
}

/**
 * Reverse a referral reward (fraud, chargeback, admin correction): append a -1
 * ledger entry and mark the referral 'reversed'. Idempotent - the unique
 * (referral_id, reason) allows at most one reversal, so a retried call is a
 * no-op (`already_reversed`). Only an 'awarded' referral can be reversed:
 * anything else reports `not_awarded` (a missing referral is `not_found`).
 *
 * Authorization is the caller's responsibility: this is a server-only function
 * and must only be invoked from an admin-gated action.
 */
export async function reverseReferralReward(referralId: string): Promise<{
  reversed: boolean;
  reason: 'reversed' | 'already_reversed' | 'not_awarded' | 'not_found';
}> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`referral-reverse:${referralId}`}))`
    );

    const rows = await tx
      .select({
        id: referralsTable.id,
        referrerId: referralsTable.referrer_user_id,
        rewardStatus: referralsTable.reward_status,
      })
      .from(referralsTable)
      .where(eq(referralsTable.id, referralId));

    const referral = rows[0];
    if (!referral) return { reversed: false, reason: 'not_found' };
    // A referral that was already reversed reports 'already_reversed' (distinct
    // from 'not_awarded') so a retried reversal's admin message is accurate.
    // This must be checked before the 'awarded' guard below: the first reversal
    // flips reward_status to 'reversed', so the retry would otherwise fall into
    // 'not_awarded' and never reach the ledger-conflict branch below.
    if (referral.rewardStatus === 'reversed') {
      return { reversed: false, reason: 'already_reversed' };
    }
    if (referral.rewardStatus !== 'awarded') {
      return { reversed: false, reason: 'not_awarded' };
    }

    const inserted = await tx
      .insert(referralCreditsTable)
      .values({
        id: randomUUID(),
        user_id: referral.referrerId,
        referral_id: referral.id,
        amount: -1,
        reason: REFERRAL_REVERSAL_REASON,
      })
      .onConflictDoNothing()
      .returning({ id: referralCreditsTable.id });

    // A reversal row already exists for this referral (unique (referral_id,
    // reason)). The reward was reversed before, so this retry is a no-op - and
    // distinct from 'not_awarded' so the admin message is accurate.
    if (inserted.length === 0) return { reversed: false, reason: 'already_reversed' };

    await tx
      .update(referralsTable)
      .set({ reward_status: 'reversed' })
      .where(eq(referralsTable.id, referral.id));

    return { reversed: true, reason: 'reversed' };
  });
}

/**
 * Everything the referral surfaces display, computed in ONE place so the
 * dashboard card and the referrals page can never disagree - and so the quota
 * stays wired to the certificate-limit system (utils/plans.ts +
 * utils/credentials.ts) rather than a second, parallel balance.
 *
 * `remaining` uses the same window and formula the mint path enforces: the
 * plan's monthly allowance (free allowance + earned credits) minus credentials
 * already minted this calendar month.
 */
export type ReferralPanelData = {
  code: string;
  credits: number;
  counts: ReferralCounts;
  usedThisMonth: number;
  monthlyLimit: number | null;
  remaining: number | null;
};

export async function getReferralPanelData(opts: {
  userId: string;
  plan: string | null | undefined;
  referralCode: string;
  freeCredentialsPerMonth: number;
}): Promise<ReferralPanelData> {
  const [credits, counts, usedRows] = await Promise.all([
    getReferralCreditBalance(opts.userId),
    countReferralsByStatus(opts.userId),
    db
      .select({ id: credentialsTable.id })
      .from(credentialsTable)
      .where(
        and(
          eq(credentialsTable.user_id, opts.userId),
          gte(credentialsTable.passed_at, monthWindowStart())
        )
      ),
  ]);

  const usedThisMonth = usedRows.length;
  const monthlyLimit = monthlyCertificateLimit(opts.plan, opts.freeCredentialsPerMonth, credits);
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - usedThisMonth);

  return {
    code: opts.referralCode,
    credits,
    counts,
    usedThisMonth,
    monthlyLimit,
    remaining,
  };
}

export type ReferralCounts = {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
};

/**
 * Referral totals per verification status for a referrer. Grouped in SQL so the
 * dashboard numbers stay consistent even when the referral list is capped.
 */
export async function countReferralsByStatus(referrerId: string): Promise<ReferralCounts> {
  const rows = await db
    .select({
      status: referralsTable.verification_status,
      count: sql<number>`count(*)::int`,
    })
    .from(referralsTable)
    .where(eq(referralsTable.referrer_user_id, referrerId))
    .groupBy(referralsTable.verification_status);

  const counts: ReferralCounts = { total: 0, verified: 0, pending: 0, rejected: 0 };
  for (const row of rows) {
    counts.total += row.count;
    if (row.status === 'verified') counts.verified = row.count;
    else if (row.status === 'pending') counts.pending = row.count;
    else if (row.status === 'rejected') counts.rejected = row.count;
  }
  return counts;
}

/** A referral row as shown on /dashboard/referrals. */
export type ReferralSummaryRow = {
  id: string;
  referredUsername: string | null;
  referredEmail: string;
  verificationStatus: string;
  rewardStatus: string;
  createdAt: Date;
};

/**
 * Referrals attributed to a referrer, newest first, joined to the referred
 * account so the dashboard can show a username. Bounded so a runaway account
 * cannot make the page unbounded.
 */
export async function listReferralsForUser(
  referrerId: string,
  limit = 50
): Promise<ReferralSummaryRow[]> {
  const rows = await db
    .select({
      id: referralsTable.id,
      referredUsername: usersTable.username,
      referredEmail: referralsTable.referred_email,
      verificationStatus: referralsTable.verification_status,
      rewardStatus: referralsTable.reward_status,
      createdAt: referralsTable.created_at,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(usersTable.id, referralsTable.referred_user_id))
    .where(eq(referralsTable.referrer_user_id, referrerId))
    .orderBy(desc(referralsTable.created_at))
    .limit(limit);

  return rows;
}

/** A referral row as shown in the admin console (both parties resolved). */
export type AdminReferralRow = {
  id: string;
  referrerUserId: string;
  referrerUsername: string | null;
  referrerEmail: string;
  referredUsername: string | null;
  referredEmail: string;
  verificationStatus: string;
  rewardStatus: string;
  createdAt: Date;
};

/**
 * Most recent referrals for the admin console, newest first, with both the
 * referrer and referred account resolved. Read-only; reversal is a separate
 * admin-gated action.
 */
export async function listRecentReferrals(limit = 100): Promise<AdminReferralRow[]> {
  const referrer = alias(usersTable, 'referrer');
  const referred = alias(usersTable, 'referred');

  return db
    .select({
      id: referralsTable.id,
      referrerUserId: referralsTable.referrer_user_id,
      referrerUsername: referrer.username,
      referrerEmail: referrer.email,
      referredUsername: referred.username,
      referredEmail: referralsTable.referred_email,
      verificationStatus: referralsTable.verification_status,
      rewardStatus: referralsTable.reward_status,
      createdAt: referralsTable.created_at,
    })
    .from(referralsTable)
    .innerJoin(referrer, eq(referrer.id, referralsTable.referrer_user_id))
    .leftJoin(referred, eq(referred.id, referralsTable.referred_user_id))
    .orderBy(desc(referralsTable.created_at))
    .limit(limit);
}
