// Read-only follow-up to scripts/rls-audit.mjs: role attributes (does the app's
// connection role bypass RLS?), Realtime publication membership, and the
// contents/columns of the RLS-disabled tables.
import { config } from 'dotenv';
config({ path: '.env.local' });

const { default: postgres } = await import('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

console.log('=== role attributes ===');
const roles = await sql`
  SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin,
         rolbypassrls, rolconnlimit
  FROM pg_roles
  WHERE rolname IN ('postgres','anon','authenticated','service_role','supabase_admin','authenticator','dashboard_user')
  ORDER BY rolname`;
for (const r of roles) {
  console.log(
    `  ${String(r.rolname).padEnd(18)} super=${r.rolsuper ? 'Y' : 'n'} bypassrls=${r.rolbypassrls ? 'Y' : 'n'} ` +
      `login=${r.rolcanlogin ? 'Y' : 'n'} createrole=${r.rolcreaterole ? 'Y' : 'n'} createdb=${r.rolcreatedb ? 'Y' : 'n'}`
  );
}

console.log('\n=== realtime publication membership ===');
const pubs = await sql`
  SELECT p.pubname, c.relname, p.puballtables, p.pubinsert, p.pubupdate, p.pubdelete
  FROM pg_publication p
  LEFT JOIN pg_publication_rel pr ON pr.prpubid = p.oid
  LEFT JOIN pg_class c ON c.oid = pr.prrelid
  ORDER BY p.pubname, c.relname`;
for (const p of pubs) {
  console.log(`  pub=${p.pubname} table=${p.relname ?? '(all)'} allTables=${p.puballtables} i=${p.pubinsert} u=${p.pubupdate} d=${p.pubdelete}`);
}

console.log('\n=== RLS-disabled tables: columns and row counts ===');
for (const table of ['app_settings', 'referrals', 'referral_credits']) {
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table}
    ORDER BY ordinal_position`;
  const count = await sql`SELECT count(*)::int AS n FROM ${sql(table)}`;
  console.log(`\n  ${table} (rows: ${count[0].n})`);
  for (const c of cols) {
    console.log(`    ${c.column_name.padEnd(28)} ${c.data_type.padEnd(28)} null=${c.is_nullable}`);
  }
}

console.log('\n=== app_settings: current values (non-secret config) ===');
try {
  const rows = await sql`SELECT id, pass_score, assessment_question_count, max_attempts_per_window, ai_model, transcript_provider, free_credentials_per_month FROM app_settings`;
  for (const r of rows) console.log('   ', r);
} catch (err) {
  console.log('   (could not read as listed columns:', err.message, ')');
}

console.log('\n=== referrals / referral_credits: shape sample (no PII) ===');
const refSample = await sql`
  SELECT status, count(*)::int AS n FROM referrals GROUP BY status ORDER BY n DESC`;
console.log('  referrals by status:', refSample);
const credSample = await sql`
  SELECT reason, count(*)::int AS n, sum(amount)::int AS total FROM referral_credits GROUP BY reason ORDER BY n DESC`;
console.log('  referral_credits by reason:', credSample);

await sql.end({ timeout: 5 });
