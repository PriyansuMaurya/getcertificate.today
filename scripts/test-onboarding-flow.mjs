// Flow test: SQL-created test user -> REST login -> ssr cookie -> routes -> DB profile -> cleanup
// Reads secrets from .env.local, never prints them. Test rows fully removed at end.
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
const email = `onboard-test-${Date.now()}@gmail.com`;
const password = 'TestPass123!';

const { default: postgres } = await import('postgres');
const sql = postgres(DB, { prepare: false });

// 0. cleanup leftovers from any earlier aborted run
await sql`DELETE FROM users_table WHERE email LIKE 'onboard-test-%'`;
await sql`DELETE FROM auth.identities WHERE email LIKE 'onboard-test-%'`;
await sql`DELETE FROM auth.users WHERE email LIKE 'onboard-test-%'`;

// 1. create confirmed test user by cloning an existing auth user row (guarantees GoTrue-compatible null/empty pattern)
const seed =
  await sql`SELECT * FROM auth.users WHERE email NOT LIKE 'onboard-test-%' AND confirmed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
if (!seed.length) {
  console.error('no seed user found');
  process.exit(1);
}
await sql`DELETE FROM auth.identities WHERE email = ${email}`;
const cloned = await sql`
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
  SELECT instance_id, gen_random_uuid(), aud, role, ${email}, crypt(${password}, gen_salt('bf')), now(), invited_at, confirmation_token, now(), recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, now(), raw_app_meta_data, jsonb_build_object('full_name', 'Onboard Test'), is_super_admin, now(), now(), phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, false, deleted_at, false
  FROM auth.users WHERE id = ${seed[0].id}
  RETURNING id`;
const userId = cloned[0].id;
console.log('1. test user created + confirmed (cloned):', userId);

// 1b. matching auth.identities row (required for password login)
await sql`
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), ${userId}, ${userId}::text, 'email', jsonb_build_object('sub', ${userId}::text, 'email', ${email}::text), now(), now(), now())`;

// 2. password login to get session
let res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = await res.json();
if (!res.ok || !session.access_token) {
  console.error('2. login failed:', res.status, session.error_description || session.msg);
  process.exit(1);
}
console.log('2. password login: session OK');

// 3. build @supabase/ssr cookie ("base64-" prefix + base64url of JSON session)
const b64url = Buffer.from(JSON.stringify(session))
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
const cookie = `sb-${ref}-auth-token=base64-${b64url}`;

// 4. GET /onboarding with session
res = await fetch(`${BASE}/onboarding`, { headers: { cookie }, redirect: 'manual' });
console.log('4. GET /onboarding:', res.status, res.headers.get('location') || '');
if (res.status !== 200) process.exit(1);
const onboardingHtml = await res.text();
console.log(
  '   page renders form:',
  onboardingHtml.includes('Complete your profile') && onboardingHtml.includes('name="username"')
);

// 5. GET /dashboard with session but no username -> expect redirect /onboarding
res = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: 'manual' });
console.log('5. GET /dashboard (no profile):', res.status, '->', res.headers.get('location') || '');

// 6. create users_table row (app signup normally does this) + fill profile
await sql`INSERT INTO users_table (id, name, email, plan, stripe_id)
  VALUES (${userId}, ${'Onboard Test'}, ${email}, 'none', 'test-stripe-id')
  ON CONFLICT (id) DO NOTHING`;
const upd =
  await sql`UPDATE users_table SET username = ${'onboardtest'}, first_name = 'Test', last_name = 'User', dob = '1990-05-15' WHERE id = ${userId} RETURNING username, first_name, last_name, dob`;
console.log('6. DB profile row:', JSON.stringify(upd[0]));

// 7. GET /dashboard again -> expect 200, greets by name, voluntary upgrade card
res = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: 'manual' });
console.log('7. GET /dashboard (with profile):', res.status, res.headers.get('location') || '');
if (res.status === 200) {
  const html = await res.text();
  console.log('   greets by name:', html.includes('Test User'));
  console.log('   voluntary upgrade card present:', html.includes('See plans &amp; pricing'));
}

// 8. GET /onboarding now -> expect redirect /dashboard
res = await fetch(`${BASE}/onboarding`, { headers: { cookie }, redirect: 'manual' });
console.log(
  '8. GET /onboarding (already onboarded):',
  res.status,
  '->',
  res.headers.get('location') || ''
);

// 9. cleanup: delete test rows (users_table first, then auth user)
await sql`DELETE FROM users_table WHERE id = ${userId}`;
await sql`DELETE FROM auth.identities WHERE user_id = ${userId}`;
await sql`DELETE FROM auth.users WHERE id = ${userId}`;
await sql.end({ timeout: 5 });
console.log('9. test rows cleaned up');
