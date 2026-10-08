// End-to-end referral lifecycle test against a real database.
//
// Exercises the exact server functions the app uses - attribution, recording,
// reward settlement, credit balance, reversal and the quota integration - so
// the whole reward path is validated against Postgres (unique indexes, CHECK
// constraints, advisory locks, atomic transactions), not just pure helpers.
//
// Two ways to run:
//
//   npm run test:referrals:local     # SPINS UP A DISPOSABLE EMBEDDED POSTGRES
//                                    # (temp data dir, thrown away on exit) and
//                                    # applies the production bootstrap. No system
//                                    # install and no DATABASE_URL needed. Uses a
//                                    # random port so a leftover cluster from a
//                                    # hard-killed run cannot block the next one.
//
//   ALLOW_REFERRAL_IT=1 npm run test:referrals
//                                    # runs against the DATABASE_URL in
//                                    # .env.local. Refuses to run unless the env
//                                    # flag is set, so it can never fire against
//                                    # the hosted instance by accident.
//
// Covers:
//   1. attribution + recording (pending row + denormalized count)
//   2. verification settles the referral and awards exactly one credit
//   3. settlement is idempotent (a retry adds no second credit)
//   4. one referred account can reward only one referrer (duplicate blocked)
//   5. concurrency: parallel settlements award exactly one credit
//   6. reversal appends -1 once and is idempotent on retry
//   7. self-referral is rejected by id and by email
//   8. the earned credit raises the free-tier certificate quota
//   9. a paid-tier referrer gets no credit (referral still verifies)
import { config } from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';

config({ path: '.env.local' });

// `--local` (or REFERRAL_IT_EMBEDDED=1) boots a throwaway embedded Postgres.
const LOCAL = process.argv.includes('--local') || process.env.REFERRAL_IT_EMBEDDED === '1';

// NOTE: the body lives in an async function rather than at the top level.
// tsx transpiles this file to CommonJS (package.json has no "type": "module"),
// where top-level await is unsupported.
async function main() {
  if (!LOCAL && process.env.ALLOW_REFERRAL_IT !== '1') {
    console.error(
      'SKIPPED: run `npm run test:referrals:local` for a disposable database, or set ALLOW_REFERRAL_IT=1 to run against DATABASE_URL.'
    );
    process.exit(0);
  }

  let embedded: import('embedded-postgres').default | null = null;
  let started = false; // only stop() a cluster we actually started
  // Assigned once the DB modules are imported; the finally block calls it only
  // if it was set, so a failure before the imports still stops the cluster.
  let cleanup: (() => Promise<void>) | null = null;
  let endDb: (() => Promise<void>) | null = null;
  let failures = 0;

  function check(label: string, ok: boolean) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (!ok) failures++;
  }

  try {
    if (LOCAL) {
      const { default: EmbeddedPostgres } = await import('embedded-postgres');
      // Random high port so a leftover cluster from an earlier run (Windows can
      // leave the postmaster alive) cannot block a fresh run. Override with
      // REFERRAL_IT_PORT for a fixed port.
      const port = Number(
        process.env.REFERRAL_IT_PORT ?? 55000 + Math.floor(Math.random() * 8000)
      );
      embedded = new EmbeddedPostgres({
        databaseDir: path.join(os.tmpdir(), `gct-referral-pg-${Date.now()}`),
        user: 'postgres',
        password: 'postgres',
        port,
        persistent: false,
        onLog: () => {},
        onError: (m) => console.error('[embedded-pg]', m instanceof Error ? m.message : m),
      });
      await embedded.initialise();
      await embedded.start();
      started = true;

      // Point the app's DB module at the throwaway cluster BEFORE it is imported.
      process.env.DATABASE_URL = `postgresql://postgres:postgres@localhost:${port}/postgres`;

      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
      try {
        // Supabase-compat shim: the production bootstrap enables RLS with
        // policies that reference auth.uid() and the `authenticated` role, which
        // a plain Postgres cluster does not have. Stub both so the bootstrap can
        // run. The app connects as `postgres` (a superuser here), which owns the
        // tables and therefore bypasses RLS - matches production behaviour.
        await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS auth;`);
        await sql.unsafe(
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF; END $$;`
        );
        await sql.unsafe(
          `CREATE OR REPLACE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;`
        );

        // Apply the project's real, idempotent production bootstrap: it creates
        // every table, index and CHECK and marks the Drizzle migrations applied -
        // exactly how a Supabase database is provisioned. (The Drizzle chain
        // itself cannot run on a fresh DB; see Section 9 of the schema file.)
        await sql.file('sql/01_production_schema.sql');
      } finally {
        await sql.end();
      }
      console.log(`[local] disposable postgres on port ${port} - production schema applied`);
    }

    // Dynamic imports (not static) so the embedded DATABASE_URL is in place
    // before the DB module reads it at import time.
    const {
      recordReferralForNewUser,
      resolveReferralAttribution,
      reverseReferralReward,
      settleReferralOnVerifiedEmail,
      getReferralCreditBalance,
      getReferralPanelData,
    } = await import('@/utils/referrals');
    const { db } = await import('@/utils/db/db');
    // Close the app's connection pool in the finally block: leftover open
    // connections keep the embedded postmaster alive on Windows, so `stop()`
    // alone can leave a listening cluster behind.
    endDb = async () => {
      await db.$client.end({ timeout: 5 });
    };
    const { usersTable, referralsTable, referralCreditsTable } = await import('@/utils/db/schema');
    const { hasCredentialQuotaRemaining } = await import('@/utils/credentials');
    const { eq, inArray } = await import('drizzle-orm');

    const ts = Date.now();
    const referrerId = `rl-ref-${ts}`;
    const paidReferrerId = `rl-paid-${ts}`;
    const referredId = `rl-new-${ts}`;
    const paidReferredId = `rl-paidnew-${ts}`;
    const referrerEmail = `rl-referrer-${ts}@example.test`;
    const paidReferrerEmail = `rl-paid-ref-${ts}@example.test`;
    const referredEmail = `rl-referred-${ts}@example.test`;
    const paidReferredEmail = `rl-paid-referred-${ts}@example.test`;
    const REFERRER_CODE = 'RLTEST82';
    const PAID_CODE = 'RLPAID82';

    cleanup = async () => {
      const ids = [referrerId, paidReferrerId, referredId, paidReferredId];
      // Reverse FK order; referral_credits -> referrals -> users_table.
      await db.delete(referralCreditsTable).where(inArray(referralCreditsTable.user_id, ids));
      await db.delete(referralsTable).where(inArray(referralsTable.referrer_user_id, ids));
      await db.delete(referralsTable).where(inArray(referralsTable.referred_user_id, ids));
      await db.delete(usersTable).where(inArray(usersTable.id, ids));
    };

    async function rewardStatusFor(referredUserId: string) {
      const rows = await db
        .select({ rewardStatus: referralsTable.reward_status, id: referralsTable.id })
        .from(referralsTable)
        .where(eq(referralsTable.referred_user_id, referredUserId));
      return rows[0];
    }

    await cleanup();

    // --- fixtures: a free referrer, a paid referrer, and two new referred users
    await db.insert(usersTable).values([
      {
        id: referrerId,
        name: 'Free Referrer',
        email: referrerEmail,
        plan: 'none',
        stripe_id: `cus_test_${referrerId}`,
        referral_code: REFERRER_CODE,
      },
      {
        id: paidReferrerId,
        name: 'Paid Referrer',
        email: paidReferrerEmail,
        plan: 'pro',
        stripe_id: `cus_test_${paidReferrerId}`,
        referral_code: PAID_CODE,
      },
      {
        id: referredId,
        name: 'Referred User',
        email: referredEmail,
        plan: 'none',
        stripe_id: `cus_test_${referredId}`,
      },
      {
        id: paidReferredId,
        name: 'Referred By Paid User',
        email: paidReferredEmail,
        plan: 'none',
        stripe_id: `cus_test_${paidReferredId}`,
      },
    ]);

    // --- 7. self-referral is rejected before anything is written
    const selfById = await resolveReferralAttribution({
      rawCode: REFERRER_CODE,
      referredUserId: referrerId,
      referredEmail: referrerEmail,
    });
    check('self-referral by id is rejected', selfById === null);
    const selfByEmail = await resolveReferralAttribution({
      rawCode: REFERRER_CODE,
      referredUserId: 'someone-else',
      referredEmail: referrerEmail,
    });
    check('same-email self-referral is rejected', selfByEmail === null);

    // --- 1. attribution + recording
    const attribution = await resolveReferralAttribution({
      rawCode: REFERRER_CODE.toLowerCase(), // normalization: lower-case input still resolves
      referredUserId: referredId,
      referredEmail,
    });
    check('a valid code resolves to the referrer', attribution?.referrerId === referrerId);
    if (!attribution) throw new Error('attribution unexpectedly null');

    check(
      'referral is recorded on first call',
      (await recordReferralForNewUser({ referredUserId: referredId, referredEmail, attribution })) ===
        true
    );
    check(
      'recording is idempotent (second call inserts nothing)',
      (await recordReferralForNewUser({ referredUserId: referredId, referredEmail, attribution })) ===
        false
    );

    const referrerRow = await db.select().from(usersTable).where(eq(usersTable.id, referrerId));
    check('referrer referral_count is 1', referrerRow[0]?.referral_count === 1);
    check('credit balance starts at 0', (await getReferralCreditBalance(referrerId)) === 0);
    check('referral starts pending', (await rewardStatusFor(referredId))?.rewardStatus === 'none');

    // --- 2. settlement awards exactly one credit
    const settled = await settleReferralOnVerifiedEmail(referredId);
    check('settlement moves pending -> verified', settled.settled === true);
    check('settlement awards a credit', settled.awarded === true);
    check('credit balance is 1', (await getReferralCreditBalance(referrerId)) === 1);
    check(
      'referral is marked awarded',
      (await rewardStatusFor(referredId))?.rewardStatus === 'awarded'
    );

    // --- 3. idempotency
    const settledAgain = await settleReferralOnVerifiedEmail(referredId);
    check('re-settling is a no-op', settledAgain.settled === false);
    check('credit balance stays 1', (await getReferralCreditBalance(referrerId)) === 1);

    // --- 4. a referred account can reward only one referrer
    const secondAttribution = await resolveReferralAttribution({
      rawCode: PAID_CODE,
      referredUserId: referredId,
      referredEmail,
    });
    if (!secondAttribution) throw new Error('second attribution unexpectedly null');
    const dup = await recordReferralForNewUser({
      referredUserId: referredId,
      referredEmail,
      attribution: secondAttribution,
    });
    check('a second referrer cannot claim the same referred account', dup === false);
    check('the second referrer got no credit', (await getReferralCreditBalance(paidReferrerId)) === 0);

    // --- 5. concurrency: reset to pending, clear the credit, then settle in parallel
    await db
      .update(referralsTable)
      .set({ verification_status: 'pending', verified_at: null, reward_status: 'none' })
      .where(eq(referralsTable.referred_user_id, referredId));
    await db.delete(referralCreditsTable).where(eq(referralCreditsTable.user_id, referrerId));

    const concurrent = await Promise.all([
      settleReferralOnVerifiedEmail(referredId),
      settleReferralOnVerifiedEmail(referredId),
      settleReferralOnVerifiedEmail(referredId),
    ]);
    check(
      'exactly one concurrent settlement wins',
      concurrent.filter((r) => r.settled).length === 1
    );
    check('concurrency produced exactly one credit', (await getReferralCreditBalance(referrerId)) === 1);

    // --- 6. reversal is idempotent and appends a single -1
    const referralId = (await rewardStatusFor(referredId))!.id;
    const reversed = await reverseReferralReward(referralId);
    check('reversal succeeds', reversed.reversed === true && reversed.reason === 'reversed');
    check('balance is back to 0 after reversal', (await getReferralCreditBalance(referrerId)) === 0);
    const reversedAgain = await reverseReferralReward(referralId);
    check(
      'second reversal is a no-op',
      reversedAgain.reversed === false && reversedAgain.reason === 'already_reversed'
    );

    // --- 8. earned credit raises the free-tier quota (1 base + 1 credit = 2)
    check(
      'a free user with 1 credit may mint 2 this month',
      hasCredentialQuotaRemaining(1, 'none', 1, false, 1) === true
    );
    check(
      'a free user with 0 credits may not mint a 2nd',
      hasCredentialQuotaRemaining(1, 'none', 1, false, 0) === false
    );

    // --- 9. a paid-tier referrer is not credited, but the referral still verifies
    const paidAttribution = await resolveReferralAttribution({
      rawCode: PAID_CODE,
      referredUserId: paidReferredId,
      referredEmail: paidReferredEmail,
    });
    check('paid referrer resolves', paidAttribution?.referrerId === paidReferrerId);
    if (!paidAttribution) throw new Error('paid attribution unexpectedly null');
    await recordReferralForNewUser({
      referredUserId: paidReferredId,
      referredEmail: paidReferredEmail,
      attribution: paidAttribution,
    });
    const paidSettled = await settleReferralOnVerifiedEmail(paidReferredId);
    check('paid referrer: referral verifies', paidSettled.settled === true);
    check('paid referrer: no credit awarded', paidSettled.awarded === false);
    check('paid referrer: balance stays 0', (await getReferralCreditBalance(paidReferrerId)) === 0);
    check(
      'paid referrer: referral marked not_applicable',
      (await rewardStatusFor(paidReferredId))?.rewardStatus === 'not_applicable'
    );

    // --- panel data: the dashboard's free-tier card is driven by this, and it must
    //     reflect the earned credits in the remaining allowance.
    const panel = await getReferralPanelData({
      userId: referrerId,
      plan: 'none',
      referralCode: REFERRER_CODE,
      freeCredentialsPerMonth: 1,
    });
    check('panel counts the verified referral', panel.counts.verified === 1);
    check('panel reflects the earned credit after reversal (0)', panel.credits === 0);
    check('panel remaining = base 1 + 0 credits', panel.remaining === 1);
  } catch (err) {
    failures++;
    console.error(
      'lifecycle test threw:',
      err instanceof Error ? (err.stack ?? err.message) : inspect(err)
    );
  } finally {
    try {
      if (cleanup) {
        await cleanup();
        console.log('cleanup complete');
      }
    } catch (err) {
      console.error('cleanup failed:', err instanceof Error ? err.message : err);
    }
    if (endDb) {
      try {
        await endDb();
      } catch (err) {
        console.error('db pool close failed:', err instanceof Error ? err.message : err);
      }
    }
    if (embedded && started) {
      try {
        await embedded.stop();
        console.log('disposable postgres stopped');
      } catch (err) {
        console.error('embedded postgres stop failed:', err instanceof Error ? err.message : err);
      }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll referral lifecycle checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
