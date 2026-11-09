// End-to-end test of the video progress pipeline against the real app:
//   - real YouTube IFrame player in Chromium
//   - real saveProgress server action -> real Postgres rows
//
// Scenarios:
//   unlock: seed the item just below the 80% gate so a few seconds of watching
//     crosses it. For a 2-3 minute course 80% is ~2 minutes of watching, which
//     is exactly where the reported "past two minutes" breakage showed up: the
//     panel calls router.refresh() and the assessment column swaps to its
//     unlocked state while the player is live. Playback must survive it.
//   watch: honest 1x playback from zero; the database must credit roughly the
//     wall-clock time, monotonically, with ranges consistent with the total.
//   rate: 2x playback from zero; the database must credit ~2x wall clock.
//
// Usage: node scripts/test-player-progress.mjs [--scenario=all] [--watch=150] [--keep]
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DB = process.env.DATABASE_URL;
const BASE = 'http://localhost:3000';

if (!SUPABASE_URL || !ANON || !DB) {
  console.error('missing env (.env.local needs SUPABASE url/anon + DATABASE_URL)');
  process.exit(1);
}

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const KEEP = args.includes('--keep');
const WATCH_SECONDS = Number(argValue('watch', 150));
const WHICH = argValue('scenario', 'all');
const VIDEO_ID = process.env.PROGRESS_TEST_VIDEO ?? 'aqz-KE-bpKQ'; // Big Buck Bunny, CC
const VIDEO_DURATION = 635;

const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
const stamp = Date.now();
const EMAIL = `player-progress-${stamp}@gmail.com`;
const PASSWORD = 'TestPass123!';

const { default: postgres } = await import('postgres');
const { chromium } = await import('playwright');
const sql = postgres(DB, { prepare: false });

const failures = [];
const notes = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, message) => {
  if (cond) console.log('   PASS:', message);
  else {
    console.log('   FAIL:', message);
    failures.push(message);
  }
};

const cleanup = async () => {
  await sql`DELETE FROM users_table WHERE email LIKE 'player-progress-%'`;
  await sql`DELETE FROM auth.identities WHERE email LIKE 'player-progress-%'`;
  await sql`DELETE FROM auth.users WHERE email LIKE 'player-progress-%'`;
};

await cleanup();

// ---------------------------------------------------------------- fixtures
const seedRows =
  await sql`SELECT id FROM auth.users WHERE email NOT LIKE 'player-progress-%' AND confirmed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
if (!seedRows.length) {
  console.error('no seed auth user to clone');
  process.exit(1);
}

const cloned = await sql`
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
  SELECT instance_id, gen_random_uuid(), aud, role, ${EMAIL}::text, crypt(${PASSWORD}::text, gen_salt('bf')), now(), invited_at, confirmation_token, now(), recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, now(), raw_app_meta_data, jsonb_build_object('full_name', 'Progress Test'::text), is_super_admin, now(), now(), phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, false, deleted_at, false
  FROM auth.users WHERE id = ${seedRows[0].id}
  RETURNING id`;
const userId = cloned[0].id;

await sql`
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), ${userId}, ${userId}::text, 'email', jsonb_build_object('sub', ${userId}::text, 'email', ${EMAIL}::text), now(), now(), now())`;

await sql`
  INSERT INTO users_table (id, name, email, plan, stripe_id, username, first_name, last_name, dob)
  VALUES (${userId}, 'Progress Test', ${EMAIL}, 'none', ${'cus_test_' + stamp}, ${'progtest' + (stamp % 100000)}, 'Progress', 'Test', '1995-01-01')`;

async function makeItem({ watchedSeconds = 0, positionSeconds = 0 }) {
  const id = crypto.randomUUID();
  const ranges = watchedSeconds > 0 ? JSON.stringify([{ start: 0, end: watchedSeconds }]) : '[]';
  const percent = Math.floor((watchedSeconds / VIDEO_DURATION) * 100);
  await sql`
    INSERT INTO learning_items (id, user_id, kind, source_url, youtube_id, title, author,
      duration_seconds, position_seconds, progress_percent, watched_seconds, watched_ranges)
    VALUES (${id}, ${userId}, 'video', ${'https://www.youtube.com/watch?v=' + VIDEO_ID},
      ${VIDEO_ID}, 'Progress E2E', 'Test', ${VIDEO_DURATION}, ${positionSeconds}, ${percent},
      ${watchedSeconds}, ${ranges}::jsonb)`;
  return id;
}

async function readRow(itemId) {
  const rows = await sql`
    SELECT duration_seconds, position_seconds, progress_percent, watched_seconds, watched_ranges,
           last_watched_at
    FROM learning_items WHERE id = ${itemId}`;
  return rows[0];
}

const rangeSum = (ranges) =>
  Array.isArray(ranges)
    ? Math.round(ranges.reduce((s, r) => s + Math.max(0, Number(r.end) - Number(r.start)), 0))
    : 0;

async function ssrCookie(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await res.json();
  if (!res.ok || !session.access_token) {
    console.error('login failed:', res.status, session.error_description || session.msg);
    process.exit(1);
  }
  const b64url = Buffer.from(JSON.stringify(session))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `sb-${ref}-auth-token=base64-${b64url}`;
}

const cookieRaw = await ssrCookie(EMAIL);
const eq = cookieRaw.indexOf('=');
const cookie = { name: cookieRaw.slice(0, eq), value: cookieRaw.slice(eq + 1), url: BASE };
console.log(`fixtures ready (user ${userId.slice(0, 8)}, video ${VIDEO_ID} ${VIDEO_DURATION}s)`);

// ---------------------------------------------------------------- browser
const browser = await chromium.launch({
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--disable-blink-features=AutomationControlled',
    '--mute-audio',
  ],
});
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1440, height: 900 },
});
await context.addCookies([cookie]);

const ytFrame = (page) => page.frameLocator('iframe[src*="youtube"]').first();

async function pressPlay(page) {
  const frame = page.locator('iframe[src*="youtube"]').first();
  await frame.waitFor({ state: 'visible', timeout: 45000 });
  await sleep(3000);
  // The embed loads CUED (no autoplay param); press play like a learner would.
  await ytFrame(page)
    .locator('.ytp-large-play-button')
    .click({ timeout: 8000 })
    .catch(() => {});
  await frame.click({ position: { x: 200, y: 150 } }).catch(() => {});
  await sleep(2500);
}

async function setPlaybackRate(page, rate) {
  const runner = ytFrame(page);
  try {
    await runner.locator('.ytp-settings-button').click({ timeout: 8000 });
    await runner.locator('.ytp-menuitem', { hasText: 'Playback speed' }).click({ timeout: 8000 });
    await runner
      .locator('.ytp-menuitem', { hasText: new RegExp(`^${rate}x?$`) })
      .first()
      .click({ timeout: 8000 });
    notes.push(`playback rate set to ${rate}x via the player menu`);
    console.log(`   note: requested ${rate}x playback via the player menu`);
    return true;
  } catch (err) {
    notes.push(`could not set playback rate ${rate}x: ${err.message.split('\n')[0]}`);
    console.log(`   note: could NOT set ${rate}x playback (${err.message.split('\n')[0]})`);
    return false;
  }
}

async function observe(page, label, seconds, itemId) {
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  page.on('console', onConsole);
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  const started = Date.now();
  const timeline = [];
  while ((Date.now() - started) / 1000 < seconds) {
    const domPercent = await page
      .locator('[role="progressbar"][aria-label="Watch progress"]')
      .getAttribute('aria-valuenow')
      .catch(() => null);
    const row = await readRow(itemId);
    timeline.push({
      t: Math.round((Date.now() - started) / 1000),
      dom: domPercent === null ? null : Number(domPercent),
      db: Number(row.progress_percent),
      watched: Number(row.watched_seconds),
      pos: Number(row.position_seconds),
      yt: page.frames().filter((f) => f.url().includes('youtube')).length,
    });
    await sleep(5000);
  }
  page.off('console', onConsole);

  console.log(`\n--- ${label} timeline (5s polls) ---`);
  for (const e of timeline) {
    console.log(
      `  t=${String(e.t).padStart(3)}s dom=${String(e.dom).padStart(3)}% db=${String(e.db).padStart(3)}% ` +
        `watched=${String(e.watched).padStart(4)}s pos=${String(e.pos).padStart(4)}s yt=${e.yt}`
    );
  }
  if (errors.length) console.log('  console errors:', errors.slice(0, 6).map((e) => e.slice(0, 160)));
  return { timeline, errors };
}

function assertMonotonic(timeline, label) {
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i].dom !== null && timeline[i - 1].dom !== null && timeline[i].dom < timeline[i - 1].dom) {
      failures.push(`${label}: displayed percent regressed at t=${timeline[i].t}s (${timeline[i - 1].dom}% -> ${timeline[i].dom}%)`);
    }
    if (timeline[i].db < timeline[i - 1].db) {
      failures.push(`${label}: db percent regressed at t=${timeline[i].t}s (${timeline[i - 1].db}% -> ${timeline[i].db}%)`);
    }
    if (timeline[i].watched < timeline[i - 1].watched) {
      failures.push(`${label}: watched_seconds regressed at t=${timeline[i].t}s (${timeline[i - 1].watched}s -> ${timeline[i].watched}s)`);
    }
  }
}

// ---------------------------------------------------------------- scenario: unlock
if (WHICH === 'all' || WHICH === 'unlock') {
  console.log('\n=== Scenario unlock: crossing the 80% gate while playing ===');
  // ~2 minutes into a 2.5 minute course - the boundary the learner reported.
  const seedWatched = Math.floor(VIDEO_DURATION * 0.775);
  const itemId = await makeItem({ watchedSeconds: seedWatched, positionSeconds: seedWatched });
  const page = await context.newPage();
  await page.goto(`${BASE}/learn/${itemId}`, { waitUntil: 'load' });
  const before = await page
    .locator('[role="progressbar"][aria-label="Watch progress"]')
    .getAttribute('aria-valuenow')
    .catch(() => null);
  ok(before !== null, `progress panel rendered (aria-valuenow=${before})`);
  const lockedButton = await page.getByRole('button', { name: /Take assessment/i }).isDisabled().catch(() => null);
  console.log(`   assessment gate before watching: ${lockedButton === true ? 'locked' : 'not locked'}`);

  await pressPlay(page);
  const { timeline } = await observe(page, 'unlock', 70, itemId);
  assertMonotonic(timeline, 'unlock');

  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  ok(last.pos > first.pos, `player kept advancing (pos ${first.pos}s -> ${last.pos}s)`);
  ok(last.watched > first.watched, `watched_seconds grew (${first.watched}s -> ${last.watched}s)`);
  const credited = last.watched - first.watched;
  const wall = last.t - first.t;
  if (wall >= 30) {
    ok(
      credited >= wall * 0.85,
      `credited ${credited}s for ${wall}s of wall clock (${(credited / wall).toFixed(2)}x, need >=0.85x)`
    );
  }
  const unlockedNow = await page
    .getByRole('button', { name: /Take assessment|Generate & start assessment/i })
    .isDisabled()
    .catch(() => null);
  console.log(`   assessment gate after watching: ${unlockedNow === false ? 'UNLOCKED' : 'still locked'} (percent ${last.dom}%)`);
  if (last.dom !== null && last.dom >= 80) {
    ok(unlockedNow === false, `gate unlocked in the UI at ${last.dom}%`);
  }

  const row = await readRow(itemId);
  ok(
    rangeSum(row.watched_ranges) === Number(row.watched_seconds),
    `watched_seconds (${row.watched_seconds}) equals sum of watched_ranges (${rangeSum(row.watched_ranges)})`
  );
  const expectedPercent = Math.floor((Number(row.watched_seconds) / Number(row.duration_seconds)) * 100);
  ok(
    Number(row.progress_percent) === expectedPercent,
    `progress_percent (${row.progress_percent}) matches floor(watched/duration) (${expectedPercent})`
  );
  await page.close();
  if (!KEEP) await sql`DELETE FROM learning_items WHERE id = ${itemId}`;
}

// ---------------------------------------------------------------- scenario: watch / rate
for (const scenario of [
  { name: 'watch', rate: 1, seconds: WATCH_SECONDS },
  { name: 'rate', rate: 2, seconds: Math.max(60, Math.round(WATCH_SECONDS / 2)) },
]) {
  if (WHICH !== 'all' && WHICH !== scenario.name) continue;
  console.log(`\n=== Scenario ${scenario.name}: honest ${scenario.rate}x playback ===`);
  const itemId = await makeItem({});
  const page = await context.newPage();
  await page.goto(`${BASE}/learn/${itemId}`, { waitUntil: 'load' });
  await pressPlay(page);
  if (scenario.rate !== 1) await setPlaybackRate(page, scenario.rate);

  const { timeline } = await observe(page, scenario.name, scenario.seconds, itemId);
  assertMonotonic(timeline, scenario.name);

  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const credited = last.watched - first.watched;
  const wall = last.t - first.t;
  const ratio = wall > 0 ? credited / wall : 0;
  console.log(`\n   credited ${credited}s over ${wall}s wall = ${ratio.toFixed(2)}x (video advanced ${last.pos - first.pos}s)`);
  ok(
    ratio >= scenario.rate * 0.85,
    `${scenario.name}: credited ${ratio.toFixed(2)}x wall, need >= ${(scenario.rate * 0.85).toFixed(2)}x`
  );
  ok(ratio <= scenario.rate * 1.15, `${scenario.name}: did not over-credit (${ratio.toFixed(2)}x)`);

  const row = await readRow(itemId);
  ok(rangeSum(row.watched_ranges) === Number(row.watched_seconds), `${scenario.name}: totals match ranges`);
  ok(
    Number(row.duration_seconds) === VIDEO_DURATION,
    `${scenario.name}: duration_seconds = ${row.duration_seconds} (expected ${VIDEO_DURATION})`
  );
  await page.close();
  if (!KEEP) await sql`DELETE FROM learning_items WHERE id = ${itemId}`;
}

await browser.close();
if (!KEEP) await cleanup();
await sql.end({ timeout: 5 });

console.log('\n================ RESULT ================');
for (const n of notes) console.log('note:', n);
if (failures.length === 0) {
  console.log('PASS: progress pipeline behaved correctly end to end');
} else {
  console.log(`FAIL (${failures.length}):`);
  for (const f of failures) console.log('  -', f);
  process.exitCode = 1;
}
