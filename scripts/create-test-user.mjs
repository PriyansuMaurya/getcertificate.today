// Creates a permanent test user with a completed onboarding profile.
import { config } from 'dotenv';
config({ path: '.env.local' });

const EMAIL = 'testuser@getcertificate.today';
const PASSWORD = 'TestPassword123!';
const FULL_NAME = 'Alex Developer';
const USERNAME = 'alexdev';
const FIRST_NAME = 'Alex';
const LAST_NAME = 'Developer';
const DOB = '1995-08-20';

const { default: postgres } = await import('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

// Reset existing test user if present
await sql`DELETE FROM users_table WHERE email = ${EMAIL}`;
await sql`DELETE FROM auth.identities WHERE email = ${EMAIL}`;
await sql`DELETE FROM auth.users WHERE email = ${EMAIL}`;

// Stripe customer creation (optional test-mode customer)
let customerId = 'cus_test_' + Date.now();
try {
  const { default: Stripe } = await import('stripe');
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customer = await stripe.customers.create({ email: EMAIL, name: FULL_NAME });
    customerId = customer.id;
  }
} catch (e) {
  console.log('Using mock Stripe customer ID:', customerId);
}

// Clone an existing confirmed auth user to guarantee valid GoTrue schema structure
const seed =
  await sql`SELECT * FROM auth.users WHERE confirmed_at IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
if (!seed.length) {
  console.error('No seed user available');
  process.exit(1);
}

const cloned = await sql`
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
  )
  SELECT
    instance_id, gen_random_uuid(), aud, role, ${EMAIL}, crypt(${PASSWORD}, gen_salt('bf')), now(),
    invited_at, confirmation_token, now(), recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at, now(),
    raw_app_meta_data, jsonb_build_object('full_name', ${FULL_NAME}::text), is_super_admin, now(), now(),
    phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status, banned_until,
    reauthentication_token, reauthentication_sent_at, false, deleted_at, false
  FROM auth.users WHERE id = ${seed[0].id}
  RETURNING id`;

const userId = cloned[0].id;

// Add auth identity for email/password login
await sql`
  INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), ${userId}, ${userId}::text, 'email',
    jsonb_build_object('sub', ${userId}::text, 'email', ${EMAIL}::text),
    now(), now(), now()
  )`;

// Insert users_table row with complete onboarding fields
await sql`
  INSERT INTO users_table (id, name, email, plan, stripe_id, username, first_name, last_name, dob)
  VALUES (${userId}, ${FULL_NAME}, ${EMAIL}, 'none', ${customerId}, ${USERNAME}, ${FIRST_NAME}, ${LAST_NAME}, ${DOB})`;

await sql.end({ timeout: 5 });

console.log('========================================');
console.log('Test user created successfully!');
console.log(`Email:    ${EMAIL}`);
console.log(`Password: ${PASSWORD}`);
console.log(`Name:     ${FULL_NAME}`);
console.log(`Username: ${USERNAME}`);
console.log(`Status:   Onboarded (Ready for Dashboard)`);
console.log('========================================');
