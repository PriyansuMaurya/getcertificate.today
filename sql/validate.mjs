// Validates sql/01_production_schema.sql + sql/02_seed_data.sql against the
// real database in .env.local WITHOUT persisting anything: both files run
// inside a transaction that is always rolled back. Exit code 0 = all checks
// passed. Run: node sql/validate.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Minimal .env.local loader (no dependency on dotenv being installed).
function loadEnv() {
  try {
    const text = readFileSync(join(root, '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* fall through to process.env */
  }
}
loadEnv();

if (!process.env.DATABASE_URL) {
  console.error('FAIL: DATABASE_URL not set (checked .env.local and environment)');
  process.exit(1);
}

const schemaSql = readFileSync(join(here, '01_production_schema.sql'), 'utf8');
const seedSql = readFileSync(join(here, '02_seed_data.sql'), 'utf8');

const notices = [];
const sql = postgres(process.env.DATABASE_URL, {
  onnotice: (n) => notices.push(n && n.message ? String(n.message) : String(n)),
  connect_timeout: 20,
});

// Same canonicalization as utils/credentials.ts (server-side scheme).
function computeCredentialHash(c) {
  const passedAt =
    c.passed_at instanceof Date ? c.passed_at.toISOString() : new Date(c.passed_at).toISOString();
  const canonical = [
    `id=${c.id}`,
    `user=${c.user_id}`,
    `item=${c.learning_item_id}`,
    `attempt=${c.attempt_id}`,
    `holder=${c.holder_name}`,
    `title=${c.item_title}`,
    `score=${c.score}`,
    `passed_at=${passedAt}`,
  ].join('|');
  return 'sha256-v1:' + createHash('sha256').update(canonical, 'utf8').digest('hex');
}

const failures = [];
function check(name, ok, detail = '') {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures.push(`${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const ROLLBACK = new Error('__ROLLBACK__');

(async () => {
  try {
    await sql.begin(async (tx) => {
      console.log('Running 01_production_schema.sql ...');
      await tx.unsafe(schemaSql);
      console.log('Running 02_seed_data.sql ...');
      await tx.unsafe(seedSql);

      console.log('\nSchema checks:');
      const tables = await tx`
        SELECT c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('users_table','learning_items','assessments','attempts','credentials')
        ORDER BY c.relname`;
      check('all 5 tables exist', tables.length === 5, `got ${tables.length}`);
      check(
        'RLS enabled on all 5 tables',
        tables.length === 5 && tables.every((r) => r.relrowsecurity),
        tables.map((r) => `${r.relname}=${r.relrowsecurity}`).join(', ')
      );
      check(
        'tables owned by postgres (app role bypasses RLS)',
        tables.length === 5 && tables.every((r) => r.owner === 'postgres'),
        tables.map((r) => `${r.relname}=${r.owner}`).join(', ')
      );

      const policies = await tx`
        SELECT tablename, policyname FROM pg_policies
        WHERE schemaname = 'public' ORDER BY tablename, policyname`;
      const expectedPolicies = [
        'users_select_own',
        'users_insert_own',
        'users_update_own',
        'learning_items_select_own',
        'learning_items_insert_own',
        'learning_items_update_own',
        'learning_items_delete_own',
        'assessments_select_own',
        'attempts_select_own',
        'credentials_select_own',
      ];
      const gotPolicies = policies.map((p) => p.policyname);
      check(
        '10 expected RLS policies present',
        expectedPolicies.every((p) => gotPolicies.includes(p)),
        `missing: ${expectedPolicies.filter((p) => !gotPolicies.includes(p)).join(',') || 'none'}; got ${gotPolicies.join(',')}`
      );
      const writePolicies = policies.filter(
        (p) =>
          ['assessments', 'attempts', 'credentials'].includes(p.tablename) &&
          ['INSERT', 'UPDATE', 'DELETE'].some((v) => p.policyname.includes(v))
      );
      check(
        'no authenticated write policy on assessments/attempts/credentials',
        writePolicies.length === 0
      );

      const checks = await tx`
        SELECT conrelid::regclass::text AS tbl, conname FROM pg_constraint
        WHERE contype = 'c'
          AND connamespace = 'public'::regnamespace
        ORDER BY 1, 2`;
      const checkNames = checks.map((c) => c.conname);
      const expectedChecks = [
        'credentials_status_check',
        'credentials_score_check',
        'attempts_score_check',
        'assessments_source_check',
        'learning_items_kind_check',
        'learning_items_status_check',
        'learning_items_progress_check',
        'learning_items_seconds_check',
      ];
      check(
        '8 CHECK constraints present',
        expectedChecks.every((c) => checkNames.includes(c)),
        `missing: ${expectedChecks.filter((c) => !checkNames.includes(c)).join(',') || 'none'}`
      );

      const uniques = await tx`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN ('users_table_email_unique','users_table_username_unique',
            'assessments_learning_item_id_unique','learning_items_user_youtube_unique',
            'credentials_user_item_unique')`;
      check(
        '5 unique constraints/indexes present',
        uniques.length === 5,
        `got ${uniques.length}: ${uniques.map((u) => u.indexname).join(',')}`
      );

      const idx = await tx`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname IN (
          'learning_items_user_updated_idx','learning_items_user_created_idx',
          'attempts_assessment_user_idx','attempts_user_created_idx','attempts_item_idx',
          'credentials_user_passed_idx','credentials_learning_item_idx',
          'credentials_attempt_idx','users_table_stripe_id_idx')`;
      check('9 performance indexes present', idx.length === 9, `got ${idx.length}`);

      const trig = await tx`
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'public.learning_items'::regclass AND NOT tgisinternal`;
      check(
        'learning_items updated_at trigger present',
        trig.length === 1 && trig[0].tgname === 'learning_items_set_updated_at',
        trig.map((t) => t.tgname).join(',')
      );

      const fks = await tx`
        SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent,
               confdeltype AS on_delete
        FROM pg_constraint WHERE contype = 'f'
          AND connamespace = 'public'::regnamespace
        ORDER BY child, parent`;
      const fkSet = new Set(fks.map((f) => `${f.child}->${f.parent}:${f.on_delete}`));
      const expectedFks = [
        'learning_items->users_table:c',
        'assessments->learning_items:c',
        'attempts->assessments:c',
        'attempts->users_table:a',
        'attempts->learning_items:c',
        'credentials->users_table:a',
        'credentials->learning_items:a',
        'credentials->attempts:a',
      ];
      check(
        '8 FKs with correct ON DELETE behaviour',
        expectedFks.every((f) => fkSet.has(f)),
        `missing: ${expectedFks.filter((f) => !fkSet.has(f)).join('; ')}`
      );

      console.log('\nDrizzle bootstrap checks:');
      const mig =
        await tx`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
      const migFiles = [
        '0000_colossal_kree',
        '0001_add-profile-fields',
        '0002_striped_misty_knight',
      ];
      const expectedMig = [
        ['9626616eefa33c26e94f4c0552355834ae9f83db00376f39548c1652f08aee78', 1748947435391],
        ['3f4d0ad912bb0823edee39aa24001aa890618aa5a62c9855ddf8bf09a629b6ad', 1790630360970],
        ['f503f55da5e086734639b8dbb9ae5e5b76900ffc2900592514bf68659dd6a832', 1790724396506],
      ];
      check(
        'migration rows = journal entries (hash + when)',
        expectedMig.every(([h, w]) => mig.some((r) => r.hash === h && Number(r.created_at) === w)),
        `got ${mig.length} rows`
      );
      const last = mig[mig.length - 1];
      check(
        'last applied migration = journal 0002 (migrator SELECT ... ORDER BY created_at DESC LIMIT 1)',
        last !== undefined && Number(last.created_at) === 1790724396506,
        last ? String(last.created_at) : 'no rows'
      );

      // Verify the stored hashes would make drizzle-kit migrate a no-op:
      // recompute sha256 of the actual migration files and compare.
      for (let i = 0; i < expectedMig.length; i++) {
        const [h] = expectedMig[i];
        const entry = migFiles[i];
        const actual = createHash('sha256')
          .update(readFileSync(join(root, 'utils/db/migrations', entry + '.sql')))
          .digest('hex');
        check(`hash matches file bytes: ${entry}`, actual === h, `${actual} != ${h}`);
      }

      console.log('\nSeed checks:');
      const counts = await tx`
        SELECT (SELECT count(*) FROM public.users_table WHERE id IN (
                 'a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002',
                 'c0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004')) AS users,
               (SELECT count(*) FROM public.learning_items) AS items,
               (SELECT count(*) FROM public.assessments) AS assessments,
               (SELECT count(*) FROM public.attempts) AS attempts,
               (SELECT count(*) FROM public.credentials) AS creds,
               (SELECT count(*) FROM auth.users WHERE email IN
                 ('ada@example.com','ben.carter@example.com','cara.silva@example.com','dev.patel@example.com')) AS auth_users,
               (SELECT count(*) FROM auth.identities WHERE user_id IN
                 ('a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002',
                  'c0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004')) AS identities`;
      check(
        'seed counts users=4 items=8 assessments=5 attempts=6 credentials=3',
        counts[0].users == 4 &&
          counts[0].items == 8 &&
          counts[0].assessments == 5 &&
          counts[0].attempts == 6 &&
          counts[0].creds == 3,
        JSON.stringify(counts[0])
      );
      check(
        'auth.users seed rows = 4, identities = 4',
        counts[0].auth_users == 4 && counts[0].identities == 4,
        `auth=${counts[0].auth_users} identities=${counts[0].identities}`
      );

      // Journey-state spot checks.
      const cara = await tx`SELECT username, first_name, dob FROM public.users_table
        WHERE id = 'c0000000-0000-4000-8000-000000000003'`;
      check(
        'cara onboarding pending (username/first_name/dob NULL)',
        cara[0].username === null && cara[0].first_name === null && cara[0].dob === null
      );

      const gate = await tx`SELECT progress_percent FROM public.learning_items
        WHERE id = 'aa000000-0000-4000-8000-000000000005'`;
      check('ben 79% gate state', gate[0].progress_percent === 79);

      const failed = await tx`SELECT count(*) AS n FROM public.attempts
        WHERE user_id = 'b0000000-0000-4000-8000-000000000002' AND passed = false
          AND created_at >= now() - interval '7 days'`;
      check(
        'ben has 2 failed attempts inside 7-day window',
        failed[0].n == 2,
        `got ${failed[0].n}`
      );

      const devCred = await tx`SELECT count(*) AS n FROM public.credentials
        WHERE user_id = 'd0000000-0000-4000-8000-000000000004'`;
      check('dev passed attempt has NO credential (mint-from-attempt state)', devCred[0].n == 0);

      const revoked = await tx`SELECT status FROM public.credentials
        WHERE id = 'f0000000-0000-4000-8000-000000000002'`;
      check('ada credential2 is revoked', revoked[0].status === 'revoked');

      // Hash parity: SQL-computed hash must equal Node recompute from the row
      // (this is exactly what /verify does server-side).
      const creds = await tx`SELECT * FROM public.credentials ORDER BY id`;
      const mismatches = creds.filter((c) => computeCredentialHash(c) !== c.hash);
      check(
        'credential hashes match utils/credentials.ts recompute (SQL vs Node)',
        mismatches.length === 0,
        mismatches.map((m) => `${m.id}: sql=${m.hash} node=${computeCredentialHash(m)}`).join('; ')
      );

      // Attempt/credential consistency: score must equal correct-answer count.
      const consistency = await tx`
        SELECT a.id,
          (SELECT count(*) FROM jsonb_array_elements(a.answers) WITH ORDINALITY ans(v, ord)
            WHERE (a.answers ->> ((ans.ord - 1)::int)) =
              ((SELECT q ->> 'correct' FROM jsonb_array_elements(as2.questions) WITH ORDINALITY qj(q, ord2)
                 WHERE qj.ord2 = ans.ord) )) AS correct,
          as2.questions, a.score
        FROM public.attempts a JOIN public.assessments as2 ON as2.id = a.assessment_id`;
      const badScores = consistency.filter(
        (r) => Math.round((r.correct / r.questions.length) * 100) !== r.score
      );
      check(
        'attempt scores consistent with answers vs question keys',
        badScores.length === 0,
        badScores
          .map(
            (b) =>
              `${b.id} score=${b.score} derived=${Math.round((b.correct / b.questions.length) * 100)}`
          )
          .join('; ')
      );

      // RLS behaviour proof: as the `authenticated` role, cara must see ada's
      // rows only as her own (simulated by SET LOCAL ROLE + auth.uid override
      // is not possible without a request context; instead assert policies
      // compile by preparing them via EXPLAIN under role authenticated).
      try {
        await tx.unsafe('SET LOCAL ROLE authenticated');
        const visible = await tx`SELECT count(*) AS n FROM public.credentials`;
        check(
          'authenticated role sees 0 credential rows (RLS active, no uid)',
          visible[0].n == 0,
          `got ${visible[0].n}`
        );
        await tx.unsafe('RESET ROLE');
      } catch (e) {
        await tx.unsafe('RESET ROLE').catch(() => {});
        check('authenticated role credential visibility test', false, e.message);
      }

      throw ROLLBACK; // always roll back — nothing persists
    });
  } catch (err) {
    if (err !== ROLLBACK) {
      console.error('\nFATAL (transaction rolled back):', err.message ?? err);
      if (notices.length) console.error('Notices:\n' + notices.join('\n'));
      await sql.end({ timeout: 5 });
      process.exit(1);
    }
  }

  if (notices.length) {
    console.log('\nNotices raised (skipped guarded constraints, expected on mature DBs):');
    for (const n of notices) console.log('  ' + n);
  }

  console.log('\nResult: transaction ROLLED BACK — database untouched.');
  if (failures.length) {
    console.log(`FAIL: ${failures.length} check(s) failed:`);
    for (const f of failures) console.log('  - ' + f);
    await sql.end({ timeout: 5 });
    process.exit(1);
  }
  console.log('PASS: all checks green. Files are safe to run in the Supabase SQL editor.');
  await sql.end({ timeout: 5 });
  process.exit(0);
})();
