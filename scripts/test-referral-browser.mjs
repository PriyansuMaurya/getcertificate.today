// End-to-end browser test for the FULL logged-out referral flow:
//
//   logged-out visitor opens /ref/<code>  -> attribution cookie is set
//   -> signs up at /signup                 -> code copied into auth metadata
//   -> "confirms email" (see NOTE)         -> account becomes verified
//   -> signs in at /login                  -> routed to onboarding
//   -> completes onboarding                -> referral recorded + settled
//   -> referrer's ledger gets +1 credit    -> shown on the referrer's dashboard
//
// NOTE: each run performs a REAL signup, so the project sends a confirmation
// email; if a project-level email rate limit is hit, signup surfaces an alert
// and the run fails (the retry loop stops on a real error rather than retrying).
//
// NOTE ON EMAIL VERIFICATION: the project has email confirmation ENABLED and
// this environment has no SUPABASE_SERVICE_ROLE_KEY, so we cannot mint the real
// confirmation link. This script simulates the user clicking that link by
// setting auth.users.email_confirmed_at directly, then drives the REAL /login
// form - which is exactly the app state the confirmation route leaves behind
// (a verified account that signs in). The settlement + attribution logic that
// runs afterwards is the app's own code, unchanged.
//
// Conventions mirror scripts/test-onboarding-browser.mjs: .env.local secrets,
// SQL-cloned confirmed auth users (GoTrue-compatible), cleanup at the end.
//
// Requires a dev server on $REFERRAL_BROWSER_BASE (default http://localhost:3000).
//
// CAVEAT: on the signup hop the browser URL lags the client-side redirect - the
// address bar can still read /onboarding while the sign-in page is what renders
// - so that step's assertion uses the rendered page, not page.url(). Other
// steps are full navigations whose URL settles and is safe to assert on.
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DB = process.env.DATABASE_URL;
const BASE = process.env.REFERRAL_BROWSER_BASE || 'http://localhost:3000';

if (!SUPABASE_URL || !ANON || !DB) {
  console.error(
    'missing env (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / DATABASE_URL)'
  );
  process.exit(1);
}

// Preflight: this drives a running app, so fail with a clear message rather
// than a wall of Playwright timeouts.
try {
  const res = await fetch(BASE);
  if (!res.ok && res.status !== 307 && res.status !== 308) {
    console.error(`app at ${BASE} returned ${res.status}; is \`npm run dev\` running?`);
    process.exit(1);
  }
} catch {
  console.error(`app is not reachable at ${BASE}. Start it with \`npm run dev\` first.`);
  process.exit(1);
}

const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
const stamp = Date.now();
// normalizeReferralCode accepts 6-12 uppercase A-Z0-9 chars.
const CODE = `REFX${String(stamp).slice(-5)}`;
const BOGUS_CODE = 'ZZZZZZZZ';
const referrerEmail = `ref-browser-referrer-${stamp}@gmail.com`;
const referredEmail = `ref-browser-referred-${stamp}@gmail.com`;
const password = 'TestPass123!';
const REFERRED_USERNAME = `reftest${stamp % 100000}`;
const REFERRER_USERNAME = `refref${stamp % 100000}`;

const { default: postgres } = await import('postgres');
const { chromium } = await import('playwright');
const sql = postgres(DB, { prepare: false });

// Test-key Stripe cleanup: completeOnboarding creates a real customer for the
// referred user; delete it so repeated runs don't accumulate orphans.
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const { default: Stripe } = await import('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch {
    stripe = null;
  }
}

const failures = [];
function check(label, ok) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures.push(label);
}

async function cleanup() {
  // Prefix-based (not just this run's two emails) so a run killed before its
  // finally still gets swept by the next run - mirrors the sibling onboarding
  // test.
  const OWNED = `ref-browser-%`;
  // Stripe customers first: they are referenced by users_table.stripe_id, so
  // they must be deleted before the rows disappear.
  if (stripe) {
    try {
      const owned = await sql`
        SELECT stripe_id FROM users_table
        WHERE email LIKE ${OWNED} AND stripe_id IS NOT NULL`;
      for (const { stripe_id } of owned) {
        // Only real Stripe ids: the referrer is seeded with a synthetic
        // cus_test_* placeholder that must not be sent to the API.
        if (
          typeof stripe_id === 'string' &&
          stripe_id.startsWith('cus_') &&
          !stripe_id.startsWith('cus_test_')
        ) {
          await stripe.customers.del(stripe_id).catch(() => {});
        }
      }
    } catch {
      // best-effort only - never let Stripe cleanup block DB cleanup
    }
  }
  await sql`DELETE FROM referral_credits WHERE user_id IN (SELECT id FROM users_table WHERE email LIKE ${OWNED})`;
  await sql`DELETE FROM referrals WHERE referred_email LIKE ${OWNED} OR referrer_user_id IN (SELECT id FROM users_table WHERE email LIKE ${OWNED})`;
  await sql`DELETE FROM users_table WHERE email LIKE ${OWNED}`;
  await sql`DELETE FROM auth.identities WHERE email LIKE ${OWNED}`;
  await sql`DELETE FROM auth.users WHERE email LIKE ${OWNED}`;
}

// 0. leftovers from aborted runs
await cleanup();

// Seed an existing confirmed auth user to clone the GoTrue row from.
const seed =
  await sql`SELECT * FROM auth.users WHERE email NOT LIKE 'ref-browser-%' AND confirmed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
if (!seed.length) {
  console.error('no seed auth user found');
  process.exit(1);
}

/** Clone a confirmed, password-signin-able auth user (GoTrue-compatible). */
async function createConfirmedAuthUser(email, fullName) {
  await sql`DELETE FROM auth.identities WHERE email = ${email}`;
  // Explicit ::text casts: without them Postgres cannot infer the parameter
  // types in crypt()/jsonb (42P18 could not determine data type of parameter).
  const cloned = await sql`
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
    SELECT instance_id, gen_random_uuid(), aud, role, ${email}::text, crypt(${password}::text, gen_salt('bf')), now(), invited_at, confirmation_token, now(), recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, now(), raw_app_meta_data, jsonb_build_object('full_name', ${fullName}::text), is_super_admin, now(), now(), phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, false, deleted_at, false
    FROM auth.users WHERE id = ${seed[0].id}
    RETURNING id`;
  const userId = cloned[0].id;
  await sql`
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), ${userId}, ${userId}::text, 'email', jsonb_build_object('sub', ${userId}::text, 'email', ${email}::text), now(), now(), now())`;
  return userId;
}

/** Mint an @supabase/ssr-compatible session cookie via the password grant. */
async function ssrCookie(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
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

function toCookieParts(raw) {
  const idx = raw.indexOf('=');
  return { name: raw.slice(0, idx), value: raw.slice(idx + 1) };
}

/**
 * Click the form's submit button until the flow progresses, retrying a silent
 * no-op: in dev a submit clicked before the server action has hydrated does
 * nothing and leaves the page on the same URL. Stops as soon as `target`
 * matches, `done()` reports the work landed (a DB signal, robust when the
 * redirect itself is slow), or an inline alert appears (a real error to report,
 * never retried). Returns the current URL.
 */
async function submitUntil(
  page,
  {
    target,
    done,
    formField = 'input[name="email"]',
    attempts = 6,
    perAttemptMs = 20000,
    label = 'submit',
  }
) {
  // Scope to the form holding this step's field: the page also contains
  // Next.js's route-announcer (role="alert", whose text is the page heading)
  // and, on auth pages, a provider form whose GitHub button is also
  // type="submit". Unscoped, the former aborts the retry loop on a false
  // "error" and the latter makes the click ambiguous (Playwright strict mode).
  // Anchoring on the field (not form order) keeps this correct if the layout
  // ever renders another form first.
  const form = page
    .locator('form')
    .filter({ has: page.locator(formField) })
    .first();
  const formAlert = form.locator('[role="alert"]');
  const progressed = async () => {
    if (target && target.test(page.url())) return true;
    if (done && (await Promise.resolve(done()).catch(() => false))) return true;
    return false;
  };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // Re-check BEFORE clicking: a slow first attempt may have already landed
    // (and navigated the form away), in which case clicking would hang.
    if (await progressed()) return page.url();
    // A vanished form is not an error - it means we already progressed; the
    // bounded timeout keeps the next iteration's `progressed()` in control.
    await form
      .locator('button[type="submit"]')
      .first()
      .click({ timeout: 10000 })
      .catch((err) => {
        // A vanished form just means we already progressed; only surface it on
        // the last attempt, where a mis-anchored formField would otherwise stay
        // hidden behind a generic "made no progress".
        if (attempt === attempts) console.log(`   ${label}: click failed -`, err.message);
      });
    const deadline = Date.now() + perAttemptMs;
    while (Date.now() < deadline) {
      if (await progressed()) return page.url();
      const alertText = (
        (await formAlert
          .first()
          .textContent()
          .catch(() => '')) || ''
      ).trim();
      if (alertText) return page.url();
      await page.waitForTimeout(300);
    }
    console.log(`   ${label}: attempt ${attempt} made no progress; retrying`);
  }
  return page.url();
}

// 1. A free-tier referrer with a known code. The profile fields matter: the
//    dashboard layout redirects to /onboarding unless username + first/last
//    name + dob are all present (hasCompletedOnboarding), so a referrer without
//    them could never reach /dashboard/referrals.
const referrerId = await createConfirmedAuthUser(referrerEmail, 'Referrer Browser');
await sql`
  INSERT INTO users_table (id, name, email, plan, stripe_id, username, first_name, last_name, dob, referral_code, referral_count)
  VALUES (${referrerId}, 'Referrer Browser', ${referrerEmail}, 'none', ${`cus_test_${referrerId.slice(0, 12)}`}, ${REFERRER_USERNAME}, 'Referrer', 'Browser', '1990-01-01', ${CODE}, 0)`;
console.log(`1. referrer ready (code ${CODE})`);

const browser = await chromium.launch({ headless: true });

try {
  // 2. A bogus code must NOT set the attribution cookie (route validates it).
  {
    const ctx = await browser.newContext({ baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/ref/${BOGUS_CODE}`, { waitUntil: 'load' });
    const cookies = await ctx.cookies(BASE);
    check('bogus code redirects to /signup', /\/signup/.test(page.url()));
    check('bogus code sets no referral cookie', !cookies.some((c) => c.name === 'referral_code'));
    await page.close();
    await ctx.close();
  }

  // 3. THE FLOW: logged-out visitor opens the referral link.
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await page.goto(`${BASE}/ref/${CODE}`, { waitUntil: 'load' });
  check('valid referral link redirects to /signup', /\/signup/.test(page.url()));
  const refCookie = (await context.cookies(BASE)).find((c) => c.name === 'referral_code');
  check('referral cookie holds the code', refCookie?.value === CODE);

  // 4. Sign up through the real form.
  await page.fill('input[name="name"]', 'Browser Referred');
  await page.fill('input[name="email"]', referredEmail);
  await page.fill('input[name="password"]', password);
  await page.check('#terms-consent');

  const authUserExists = async () => {
    const rows = await sql`SELECT 1 FROM auth.users WHERE email = ${referredEmail}`;
    return rows.length > 0;
  };
  await submitUntil(page, {
    target: /\/login/,
    done: authUserExists,
    formField: 'input[name="email"]',
    label: 'signup',
  });
  // With email confirmation enabled there is no session, so the action's
  // /onboarding target is bounced to the sign-in page. Assert on the RENDERED
  // page, not the URL: the browser bar can keep /onboarding through the
  // client-side redirect while the login page is what actually renders. Use the
  // page's own heading (the provider buttons also say "Sign in ...", so a
  // /Sign In/i role match is ambiguous in Playwright strict mode).
  const signInHeading = page.getByRole('heading', { name: 'Welcome back', exact: true });
  await signInHeading.waitFor({ state: 'visible', timeout: 45000 }).catch(() => {});
  const hasLoginHeading = await signInHeading.isVisible().catch(() => false);
  const postSignupAlert = hasLoginHeading
    ? ''
    : (
        (await page
          .locator('form [role="alert"]')
          .first()
          .textContent()
          .catch(() => '')) || ''
      ).trim();
  console.log(
    '   post-signup: url=',
    page.url(),
    '| signInPage=',
    hasLoginHeading,
    postSignupAlert ? `| alert=${JSON.stringify(postSignupAlert)}` : ''
  );
  // An unconfirmed signup does not reach the app: it lands on the sign-in page,
  // proving the confirmation gate - the account exists but cannot be used yet.
  check('unconfirmed signup lands on the sign-in page (confirmation pending)', hasLoginHeading);

  const authUser = await sql`
    SELECT id, raw_user_meta_data, email_confirmed_at FROM auth.users WHERE email = ${referredEmail}`;
  check('referred auth user was created', authUser.length === 1);
  check(
    'signup copied the referral code into auth metadata',
    authUser[0]?.raw_user_meta_data?.referral_code === CODE
  );
  check('referred user is not yet email-confirmed', !authUser[0]?.email_confirmed_at);
  const preRow =
    await sql`SELECT count(*)::int AS n FROM users_table WHERE email = ${referredEmail}`;
  check('no users_table row before onboarding', preRow[0].n === 0);
  const preCredit =
    await sql`SELECT count(*)::int AS n FROM referral_credits WHERE user_id = ${referrerId}`;
  check('no credit granted before verification/onboarding', preCredit[0].n === 0);

  // 5. Simulate the user clicking the confirmation email (see NOTE at top).
  console.log(
    '   NOTE: email verification is SIMULATED (setting email_confirmed_at), not a real link click'
  );
  await sql`
    UPDATE auth.users SET email_confirmed_at = now(), confirmation_token = '', confirmation_sent_at = now()
    WHERE email = ${referredEmail}`;

  // 6. Sign in through the real login form. Gate on the onboarding form
  //    actually rendering rather than the address bar: the URL can lag behind
  //    the client-side redirect, so a URL target would match a stale
  //    /onboarding and make this pass before the sign-in even completes.
  await page.fill('input[name="email"]', referredEmail);
  await page.fill('input[name="password"]', password);
  const onboardingFormVisible = () =>
    page
      .locator('input[name="username"]')
      .first()
      .isVisible()
      .catch(() => false);
  await submitUntil(page, {
    done: onboardingFormVisible,
    formField: 'input[name="email"]',
    label: 'login',
  });
  check('verified sign-in reaches the onboarding form', await onboardingFormVisible());

  // 7. Complete onboarding (drives the real DOB calendar picker).
  await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('input[name="username"]', REFERRED_USERNAME);
  await page.fill('input[name="firstName"]', 'Browser');
  await page.fill('input[name="lastName"]', 'Referred');
  {
    const [y, m, d] = [1995, 6, 15];
    await page.click('#dob');
    const calendar = page.locator('[data-slot="calendar"]');
    await calendar.waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: 'Show year picker' }).click();
    const yearBtn = calendar.getByRole('button', { name: String(y), exact: true });
    for (let i = 0; i < 12 && !(await yearBtn.isVisible().catch(() => false)); i++) {
      await page.getByRole('button', { name: 'Previous years' }).click();
    }
    await yearBtn.click();
    const monthShort = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    await calendar.getByRole('button', { name: monthShort, exact: true }).click();
    const dayLabel = new Date(y, m - 1, d).toDateString();
    await calendar.getByRole('button', { name: dayLabel, exact: true }).click();
  }
  const referredUsersRowExists = async () => {
    const rows = await sql`SELECT 1 FROM users_table WHERE email = ${referredEmail}`;
    return rows.length > 0;
  };
  await submitUntil(page, {
    target: /\/dashboard/,
    done: referredUsersRowExists,
    formField: 'input[name="username"]',
    label: 'onboarding',
  });
  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
  check('onboarding completes and reaches /dashboard', /\/dashboard/.test(page.url()));

  // 8. The referrer receives exactly one credit, and only via this flow.
  const referredRow = await sql`SELECT id FROM users_table WHERE email = ${referredEmail}`;
  check('referred users_table row was created by onboarding', referredRow.length === 1);
  const referrals =
    await sql`SELECT * FROM referrals WHERE referred_user_id = ${referredRow[0]?.id}`;
  check('a referral row was recorded', referrals.length === 1);
  check('referral is attributed to the referrer', referrals[0]?.referrer_user_id === referrerId);
  check(
    'referral verification_status is verified',
    referrals[0]?.verification_status === 'verified'
  );
  check('referral reward_status is awarded', referrals[0]?.reward_status === 'awarded');
  const credits =
    await sql`SELECT amount, reason FROM referral_credits WHERE user_id = ${referrerId}`;
  check(
    'referrer has exactly one +1 credit',
    credits.length === 1 && credits[0].amount === 1 && credits[0].reason === 'referral_verified'
  );
  const count = await sql`SELECT referral_count FROM users_table WHERE id = ${referrerId}`;
  check('referrer referral_count is 1', count[0]?.referral_count === 1);

  // 9. The referrer's own dashboard reflects the credited referral.
  const referrerCookie = await ssrCookie(referrerEmail);
  const refCtx = await browser.newContext({ baseURL: BASE });
  await refCtx.addCookies([{ ...toCookieParts(referrerCookie), url: BASE }]);
  const refPage = await refCtx.newPage();
  const resp = await refPage.goto(`${BASE}/dashboard/referrals`, { waitUntil: 'load' });
  const html = await refPage.content();
  console.log('   referrer page url:', refPage.url(), '| status:', resp?.status());
  check('referrer /dashboard/referrals returns 200', resp?.status() === 200);
  check(
    'referrer page is /dashboard/referrals (not bounced to /onboarding|/login)',
    /\/dashboard\/referrals\/?$/.test(refPage.url())
  );
  check(
    'referrer referrals page lists the referred account',
    html.includes(`@${REFERRED_USERNAME}`) || html.includes(referredEmail)
  );
  await refCtx.close();
} catch (err) {
  failures.push(`unexpected error: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  // cleanup + browser close must always run, even when an assertion throws
  await browser.close();
  await cleanup();
  await sql.end({ timeout: 5 });
  console.log('cleanup complete');
}

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nAll referral browser-flow checks passed.');
