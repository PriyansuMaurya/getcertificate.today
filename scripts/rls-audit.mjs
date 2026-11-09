// Read-only audit of row-level security, grants, and policies in the public
// schema. Reproduces what Supabase's `rls_disabled_in_public` advisor lint
// checks, straight from the catalogs, and maps who can reach what.
//
// Usage: node scripts/rls-audit.mjs
import { config } from 'dotenv';
config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const { default: postgres } = await import('postgres');
const sql = postgres(url, { prepare: false, max: 1 });

const who = await sql`SELECT current_user AS u, session_user AS su, current_database() AS db, version() AS v`;
console.log('connected as:', who[0].u, '| session:', who[0].su, '| db:', who[0].db);
console.log('server:', String(who[0].version).split(',')[0]);

console.log('\n=== public tables: RLS status ===');
const tables = await sql`
  SELECT c.relname,
         c.relkind,
         pg_get_userbyid(c.relowner) AS owner,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced,
         c.reltuples::bigint AS est_rows,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  ORDER BY c.relrowsecurity, c.relname`;
for (const t of tables) {
  const flag = t.rls_enabled ? 'RLS ON ' : 'RLS OFF';
  console.log(
    `  ${flag} ${t.rls_forced ? '(forced) ' : '         '}${t.relname.padEnd(28)} ` +
      `owner=${String(t.owner).padEnd(18)} est_rows=${String(t.est_rows).padStart(7)} size=${t.total_size}`
  );
}

const withoutRls = tables.filter((t) => !t.rls_enabled).map((t) => t.relname);
console.log('\n  -> tables WITHOUT row level security:', withoutRls.length ? withoutRls.join(', ') : '(none)');

console.log('\n=== views / matviews in public ===');
const views = await sql`
  SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner,
         COALESCE((SELECT option_value FROM pg_options_to_table(c.reloptions)
                   WHERE option_name = 'security_invoker'), 'off') AS security_invoker
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  ORDER BY c.relname`;
for (const v of views) {
  console.log(`  ${v.relname.padEnd(28)} kind=${v.relkind} owner=${v.owner} security_invoker=${v.security_invoker}`);
}

console.log('\n=== role grants on public tables (anon / authenticated) ===');
const grants = await sql`
  SELECT table_name, grantee, string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
  GROUP BY table_name, grantee
  ORDER BY table_name, grantee`;
for (const g of grants) {
  console.log(`  ${String(g.table_name).padEnd(28)} ${String(g.grantee).padEnd(15)} ${g.privs}`);
}
if (grants.length === 0) console.log('  (no anon/authenticated/public grants on public tables)');

console.log('\n=== default privileges (what NEW tables inherit) ===');
const defacl = await sql`
  SELECT pg_get_userbyid(d.defaclrole) AS grantor,
         n.nspname AS schema,
         d.defaclobjtype AS objtype,
         d.defaclacl::text AS acl
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  ORDER BY n.nspname, d.defaclobjtype`;
for (const d of defacl) {
  console.log(`  schema=${d.schema} type=${d.objtype} grantor=${d.grantor}\n     ${d.acl}`);
}
if (defacl.length === 0) console.log('  (no default ACLs)');

console.log('\n=== existing policies ===');
const policies = await sql`
  SELECT tablename, policyname, roles::text AS roles, cmd, qual,
         COALESCE(with_check, '(none)') AS with_check
  FROM pg_policies WHERE schemaname = 'public'
  ORDER BY tablename, policyname`;
for (const p of policies) {
  console.log(
    `  ${String(p.tablename).padEnd(22)} ${String(p.policyname).padEnd(34)} ${String(p.cmd).padEnd(7)} ` +
      `roles=${p.roles}\n     using=${p.qual}\n     check=${p.with_check}`
  );
}
if (policies.length === 0) console.log('  (no policies defined in public)');

console.log('\n=== sequences in public (grant exposure) ===');
const seqs = await sql`
  SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'S' ORDER BY c.relname`;
for (const s of seqs) console.log(`  ${s.relname} owner=${s.owner}`);

console.log('\n=== functions in public ===');
const funcs = await sql`
  SELECT p.proname, pg_get_userbyid(p.proowner) AS owner,
         CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'invoker' END AS sec,
         COALESCE(array_to_string(p.proconfig, ','), '(no proconfig)') AS config
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' ORDER BY p.proname`;
for (const f of funcs) {
  console.log(`  ${String(f.proname).padEnd(34)} ${String(f.sec).padEnd(17)} owner=${f.owner} config=${f.config}`);
}

await sql.end({ timeout: 5 });
