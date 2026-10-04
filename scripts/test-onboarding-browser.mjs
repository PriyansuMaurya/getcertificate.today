// Browser flow test for completeOnboarding username handling:
//   A) fresh user submits a new username -> reaches /dashboard, NO "already taken" error
//   B) second user submits the same username -> "That username is already taken" appears
//   C) the users_table row is NOT created at sign-in - only after onboarding
//      supplies every detail (username, first/last name, DOB)
// Follows scripts/test-onboarding-flow.mjs conventions: .env.local secrets, SQL-cloned
// confirmed auth users (GoTrue-compatible), SSR cookie injection, full cleanup at end.
import { config } from 'dotenv';
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DB = process.env.DATABASE_URL;
const BASE = 'http://localhost:3000';

if (!SUPABASE_URL || !ANON || !DB) {
  console.error('missing env');
  process.exit(1);
}

const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
const stamp = Date.now();
const emailA = `onboard-browser-a-${stamp}@gmail.com`;
const emailB = `onboard-browser-b-${stamp}@gmail.com`;
const password = 'TestPass123!';
const CLAIMED_USERNAME = `btestuser${stamp % 100000}`;

const { default: postgres } = await import('postgres');
const { chromium } = await import('playwright');
const sql = postgres(DB, { prepare: false });
// Test-mode key: lets cleanup delete the customers completeOnboarding creates
// so repeated runs don't accumulate orphans in the Stripe test account.
// Guarded like cleanup itself - if the package or key is unavailable the test
// still runs, it just skips Stripe cleanup rather than failing at load time.
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const { default: Stripe } = await import('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } catch {
    stripe = null;
  }
}

// Declared before any assertion runs (otherwise the step-1 pre-onboarding
// row check would hit the temporal dead zone below).
const failures = [];

const cleanup = async () => {
  // Remove any Stripe customers this run created (completeOnboarding attaches
  // them to users_table.stripe_id) before the rows disappear with them.
  if (stripe) {
    try {
      const owned =
        await sql`SELECT stripe_id FROM users_table WHERE email LIKE 'onboard-browser-%' AND stripe_id IS NOT NULL`;
      for (const { stripe_id } of owned) {
        if (stripe_id.startsWith('cus_')) {
          await stripe.customers.del(stripe_id).catch(() => {});
        }
      }
    } catch {
      // best-effort only - never let Stripe cleanup block DB cleanup
    }
  }
  await sql`DELETE FROM users_table WHERE email LIKE 'onboard-browser-%'`;
  await sql`DELETE FROM auth.identities WHERE email LIKE 'onboard-browser-%'`;
  await sql`DELETE FROM auth.users WHERE email LIKE 'onboard-browser-%'`;
};

// 0. leftovers from aborted runs
await cleanup();

// 1. create two confirmed test users by cloning an existing auth user row
const seed =
  await sql`SELECT * FROM auth.users WHERE email NOT LIKE 'onboard-browser-%' AND confirmed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
if (!seed.length) {
  console.error('no seed user found');
  process.exit(1);
}

async function createConfirmedUser(email, fullName) {
  await sql`DELETE FROM auth.identities WHERE email = ${email}`;
  // Explicit ::text casts: without them Postgres cannot infer the parameter
  // types (42P18 could not determine data type of parameter) in crypt()/jsonb.
  const cloned = await sql`
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
    SELECT instance_id, gen_random_uuid(), aud, role, ${email}::text, crypt(${password}::text, gen_salt('bf')), now(), invited_at, confirmation_token, now(), recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, now(), raw_app_meta_data, jsonb_build_object('full_name', ${fullName}::text), is_super_admin, now(), now(), phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, false, deleted_at, false
    FROM auth.users WHERE id = ${seed[0].id}
    RETURNING id`;
  const userId = cloned[0].id;
  await sql`
    INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), ${userId}, ${userId}::text, 'email', jsonb_build_object('sub', ${userId}::text, 'email', ${email}::text), now(), now(), now())`;
  // NOTE: deliberately NO users_table row here. Since deferred user creation,
  // signing in only establishes the auth user - the row is created by
  // completeOnboarding once every detail is supplied (asserted below).
  return userId;
}

const userA = await createConfirmedUser(emailA, 'Browser Test A');
const userB = await createConfirmedUser(emailB, 'Browser Test B');
console.log('1. test users created:', userA, userB);

// Assert deferred creation: auth users exist but no local users_table row yet.
const preRows = await sql`SELECT id FROM users_table WHERE email IN (${emailA}, ${emailB})`;
if (preRows.length !== 0) {
  failures.push(`expected 0 users_table rows before onboarding, found ${preRows.length}`);
} else {
  console.log('   PASS: no users_table row created at sign-in (deferred to onboarding)');
}

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

const cookieA = await ssrCookie(emailA);
const cookieB = await ssrCookie(emailB);
console.log('2. sessions established for both users');

const browser = await chromium.launch({ headless: true });

/** Parse `name=value` into a Playwright cookie pair. */
function toCookieParts(raw) {
  const idx = raw.indexOf('=');
  return { name: raw.slice(0, idx), value: raw.slice(idx + 1) };
}

async function onboard(context, { username, firstName, lastName, dob, expectTaken, expectHint }) {
  const page = await context.newPage();
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'load' });
  await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 15000 });

  const rendered = (await page.locator('input[name="username"]').count()) > 0;
  if (!rendered) {
    failures.push('onboarding form did not render');
    await page.close();
    return;
  }

  await page.fill('input[name="username"]', username);

  // Live availability hint (debounced 400ms server-side + round-trip)
  if (expectHint) {
    const hintShown = await page
      .getByText(expectHint, { exact: false })
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (hintShown) {
      console.log(`   PASS: live hint shown: "${expectHint}"`);
    } else {
      failures.push(`live availability hint "${expectHint}" not shown while typing`);
    }
  }

  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);

  // Date of birth: calendar picker (popover trigger #dob -> animated Calendar
  // in components/ui/calendar.tsx). Drive it like a user: quick-nav year
  // grid -> month grid -> day button (aria-label = Date#toDateString()).
  {
    const [y, m, d] = dob.split('-').map(Number);
    await page.click('#dob');
    const calendar = page.locator('[data-slot="calendar"]');
    await calendar.waitFor({ state: 'visible', timeout: 10000 });

    // Years view: the 12-year window may need paging back for older DOBs.
    await page.getByRole('button', { name: 'Show year picker' }).click();
    const yearBtn = calendar.getByRole('button', { name: String(y), exact: true });
    for (let i = 0; i < 12 && !(await yearBtn.isVisible().catch(() => false)); i++) {
      await page.getByRole('button', { name: 'Previous years' }).click();
    }
    const yearFound = await yearBtn.isVisible().catch(() => false);
    if (!yearFound) {
      failures.push(`calendar year ${y} not reachable in year picker`);
      await page.close();
      return;
    }

    await yearBtn.click(); // years -> months view

    // Months view: 3-letter month buttons (e.g. "Jun").
    const monthShort = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    const monthBtn = calendar.getByRole('button', { name: monthShort, exact: true });
    await monthBtn.waitFor({ state: 'visible', timeout: 10000 });
    await monthBtn.click(); // months -> days view

    // Days view: day buttons carry aria-label = toDateString(),
    // e.g. "Fri Jun 15 1995".
    const dayLabel = new Date(y, m - 1, d).toDateString();
    const dayBtn = calendar.getByRole('button', { name: dayLabel, exact: true });
    await dayBtn.waitFor({ state: 'visible', timeout: 10000 });
    await dayBtn.click();

    // popover closes on select; assert the trigger shows the picked date
    const expectedLabel = new Date(y, m - 1, d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const triggerText = await page.locator('#dob').innerText();
    if (!triggerText.includes(expectedLabel)) {
      failures.push(
        `dob trigger does not show picked date "${expectedLabel}" (shows "${triggerText}")`
      );
    }
  }

  await page.click('button[type="submit"]');

  const takenError = page.getByText('That username is already taken. Please choose another one.');

  if (expectTaken) {
    // Wait for the server action response to render the error - an instant
    // isVisible() check races the round-trip and reports false negatives.
    const shown = await takenError
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (shown) {
      console.log('   PASS: duplicate username correctly rejected');
      // Regression guard for the "fields must stay intact" requirement:
      // a failed submit must not wipe what the user already filled in.
      const fn = await page.inputValue('input[name="firstName"]');
      const ln = await page.inputValue('input[name="lastName"]');
      const dobTrigger = await page.locator('#dob').innerText();
      const un = await page.inputValue('input[name="username"]');
      if (fn !== firstName || ln !== lastName || un !== username) {
        failures.push(
          `fields not intact after error (username=${un}, firstName=${fn}, lastName=${ln})`
        );
      } else if (!dobTrigger) {
        failures.push('dob not intact after error');
      } else {
        console.log('   PASS: all fields intact after the error');
      }
    } else {
      failures.push('expected "username already taken" error for duplicate username, not shown');
    }
    // Rejected submit must not create a partial row either.
    const rowsB = await sql`SELECT id FROM users_table WHERE email = ${emailB}`;
    if (rowsB.length !== 0) {
      failures.push('users_table row created for user B despite failed onboarding');
    } else {
      console.log('   PASS: no users_table row after failed onboarding attempt');
    }
  } else {
    // success path redirects to /dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => {});
    const onDashboard = /\/dashboard/.test(page.url());
    if (onDashboard) {
      console.log('   PASS: onboarding submitted, redirected to /dashboard');
    } else {
      // stay on /onboarding? then surface whatever error was shown
      const errText =
        (await page
          .locator('[role="alert"]')
          .textContent()
          .catch(() => null)) || '';
      failures.push(`expected redirect to /dashboard, ended at ${page.url()} (alert: ${errText})`);
    }
    const falsePositive = await takenError.isVisible().catch(() => false);
    if (falsePositive) {
      failures.push(`FALSE POSITIVE: "${username}" wrongly reported as already taken`);
    }
  }
  await page.close();
}

try {
  // 3. User A claims a brand-new username - must succeed with NO error
  console.log('3. user A onboarding (fresh username, expect success)');
  const ctxA = await browser.newContext({ baseURL: BASE });
  await ctxA.addCookies([{ ...toCookieParts(cookieA), url: BASE }]);
  // Before onboarding completes, /subscribe must bounce to /onboarding
  // (no users row exists to attach a plan to yet).
  {
    const guardPage = await ctxA.newPage();
    await guardPage.goto(`${BASE}/subscribe`, { waitUntil: 'load' });
    await guardPage.waitForURL(/\/onboarding/, { timeout: 15000 }).catch(() => {});
    if (/\/onboarding/.test(guardPage.url())) {
      console.log('   PASS: /subscribe redirects to /onboarding while un-onboarded');
    } else {
      failures.push(`/subscribe did not redirect to /onboarding (at ${guardPage.url()})`);
    }
    await guardPage.close();
  }
  await onboard(ctxA, {
    username: CLAIMED_USERNAME,
    firstName: 'Browser',
    lastName: 'Tester',
    dob: '1995-06-15',
    expectTaken: false,
    expectHint: 'This username is available.',
  });

  // Success path must have created the deferred row with every supplied detail.
  const rowA =
    await sql`SELECT username, first_name, last_name, dob, stripe_id FROM users_table WHERE email = ${emailA}`;
  if (
    rowA.length !== 1 ||
    rowA[0].username !== CLAIMED_USERNAME ||
    rowA[0].first_name !== 'Browser' ||
    rowA[0].last_name !== 'Tester' ||
    String(
      rowA[0].dob instanceof Date
        ? rowA[0].dob.toISOString().slice(0, 10)
        : String(rowA[0].dob).slice(0, 10)
    ) !== '1995-06-15' ||
    !rowA[0].stripe_id ||
    rowA[0].stripe_id === 'test-stripe-id'
  ) {
    failures.push(`user A row missing/incomplete after onboarding: ${JSON.stringify(rowA)}`);
  } else {
    console.log(
      '   PASS: users_table row created with all details + Stripe customer after onboarding'
    );
  }

  // 4. User B submits the SAME username - must be rejected
  console.log('4. user B onboarding (duplicate username, expect rejection)');
  const ctxB = await browser.newContext({ baseURL: BASE });
  await ctxB.addCookies([{ ...toCookieParts(cookieB), url: BASE }]);
  await onboard(ctxB, {
    username: CLAIMED_USERNAME,
    firstName: 'Browser',
    lastName: 'Two',
    dob: '1996-07-16',
    expectTaken: true,
    expectHint: 'That username is already taken. Please choose another one.',
  });

  // 5. User B retries with a fresh username - must succeed (recovery from the error)
  console.log('5. user B onboarding retry (new username, expect success)');
  await onboard(ctxB, {
    username: `${CLAIMED_USERNAME}_b`,
    firstName: 'Browser',
    lastName: 'Two',
    dob: '1996-07-16',
    expectTaken: false,
  });

  // 6. verify final DB state: both users present after their successful onboarding
  const rows =
    await sql`SELECT username FROM users_table WHERE email IN (${emailA}, ${emailB}) ORDER BY email`;
  console.log('6. final usernames in DB:', JSON.stringify(rows));
  if (rows.length !== 2) {
    failures.push(`expected 2 rows after both onboardings, found ${rows.length}`);
  }
} catch (err) {
  failures.push(`unexpected error: ${err.message}`);
} finally {
  // cleanup + browser close must always run, even when an assertion throws
  await browser.close();
  await cleanup();
  await sql.end({ timeout: 5 });
  console.log('7. test rows cleaned up');
}

if (failures.length) {
  console.error('\nFAILURES:');
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nALL BROWSER ASSERTIONS PASSED');
