// Preflight check: verify DATABASE_URL is set and reachable before `drizzle-kit migrate`,
// which exits 1 with no error message when the database is unreachable.
// Keep env loading in sync with drizzle.config.ts.
import { config } from 'dotenv';

if (process.env.NODE_ENV === 'production') {
  config({ path: '.env' });
}
config({ path: '.env.local' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    '[db-preflight] DATABASE_URL is not set. On Vercel, add it in Project Settings > ' +
      'Environment Variables (must be enabled for Builds); locally, put it in .env.local.'
  );
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('[db-preflight] DATABASE_URL is not a valid PostgreSQL connection string.');
  process.exit(1);
}

console.log(
  `[db-preflight] target host=${parsed.hostname} port=${parsed.port || '5432'} ` +
    `user=${parsed.username || '(none)'} db=${parsed.pathname || '(none)'}`
);

const { default: postgres } = await import('postgres');
const sql = postgres(url, { prepare: false, connect_timeout: 5 });
let failed = false;
try {
  await sql`select 1`;
  console.log('[db-preflight] connection OK');
} catch (err) {
  failed = true;
  console.error('[db-preflight] connection FAILED');
  console.error(`[db-preflight] ${err.message ?? String(err)}`);
  if (err.code) console.error(`[db-preflight] code: ${err.code}`);
  if (err.errno) console.error(`[db-preflight] errno: ${err.errno}`);
  console.error(
    '[db-preflight] hint: build machine may be blocked by database firewall/IP allowlist, ' +
      'or host/port/sslmode in DATABASE_URL is wrong.'
  );
} finally {
  // Never let cleanup errors mask the diagnostics above.
  try {
    await sql.end({ timeout: 5 });
  } catch {
    // ignore - process is exiting anyway
  }
}
if (failed) process.exit(1);
