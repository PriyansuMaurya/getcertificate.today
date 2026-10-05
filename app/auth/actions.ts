'use server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { bootstrapOAuthUser } from '@/app/auth/user-bootstrap';
import { hasCompletedOnboarding } from '@/app/auth/onboarding-status';
import { ONBOARDING_PENDING_COOKIE, onboardingPendingCookie } from '@/lib/onboarding-cookie';
import { createStripeCustomer, stripe } from '@/utils/stripe/api';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { and, eq, ne } from 'drizzle-orm';

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

export async function completeOnboarding(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const username = (formData.get('username') as string | null)?.trim() ?? '';
  const firstName = (formData.get('firstName') as string | null)?.trim() ?? '';
  const lastName = (formData.get('lastName') as string | null)?.trim() ?? '';
  const dob = (formData.get('dob') as string | null)?.trim() ?? '';

  if (!username || !firstName || !lastName || !dob) {
    return { message: 'All fields are required.' };
  }

  // GDPR proof of consent: password signups store a timestamp in auth
  // metadata at /signup; OAuth users first see the checkbox here. Server-side
  // check - the client checkbox alone is never trusted.
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const storedConsent = metadata?.terms_consented_at;
  const hasStoredConsent = typeof storedConsent === 'string' && storedConsent.length > 0;
  if (!hasStoredConsent && formData.get('termsConsent') !== 'true') {
    return { message: 'Please agree to the Terms of Service and Privacy Policy to continue.' };
  }

  if (firstName.length > 100 || lastName.length > 100) {
    return { message: 'Name must be 100 characters or fewer.' };
  }

  if (dob.length > 10) {
    return { message: 'Please enter a valid date of birth.' };
  }

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return {
      message: 'Username must be 3-20 characters: lowercase letters, numbers, underscores only.',
    };
  }

  const age = calculateAge(dob);
  if (age === null) {
    return { message: 'Please enter a valid date of birth.' };
  }
  if (age < 13) {
    return { message: 'You must be at least 13 years old to create an account.' };
  }

  // Friendly pre-check; the unique constraint in the DB is the source of truth.
  // Only the username column is unique here: check for OTHER users holding this
  // username, excluding the current user's own row (so keeping a pre-filled
  // username from OAuth bootstrap is always allowed). Matching on email as
  // well made every username appear taken whenever the signed-in email pointed
  // at a users row with a different id.
  const conflict = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.username, username), ne(usersTable.id, user.id)));

  if (conflict.length > 0) {
    return { message: 'That username is already taken. Please choose another one.' };
  }

  // Proof-of-consent timestamp for the users row: prefer the value captured
  // at signup (auth metadata); otherwise the checkbox just accepted here.
  const parsedConsent = hasStoredConsent ? new Date(storedConsent as string) : new Date();
  const termsConsentedAt = Number.isNaN(parsedConsent.getTime()) ? new Date() : parsedConsent;

  let stripeID: string | undefined;
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    if (existing.length > 0) {
      // Returning user: only the profile details change.
      await db
        .update(usersTable)
        .set({
          username,
          first_name: firstName,
          last_name: lastName,
          dob,
        })
        .where(eq(usersTable.id, user.id));
    } else {
      // First-time save: this is the single place a user record is created.
      // Nothing exists until username, name and DOB are all supplied (both
      // OAuth and password sign-ups skip row creation on their own paths).
      const email = user.email;
      if (!email) {
        return { message: 'Your account has no email address. Please contact support.' };
      }
      const name = `${firstName} ${lastName}`;
      // users_table.stripe_id is NOT NULL, so the Stripe customer has to exist
      // before the insert. If the insert then fails (username race, DB error),
      // the outer catch below deletes the just-created customer so no orphan
      // is stranded in Stripe.
      stripeID = await createStripeCustomer(user.id, email, name);
      await db.insert(usersTable).values({
        id: user.id,
        name,
        email,
        stripe_id: stripeID,
        plan: 'none',
        username,
        first_name: firstName,
        last_name: lastName,
        dob,
        terms_consented_at: termsConsentedAt,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    // Clean up FIRST: every failure after the customer was created (username
    // race, DB error) must remove it rather than leaking an unreferenced
    // Stripe record - the next attempt creates a fresh one. Never masks the
    // user-facing error below.
    if (stripeID) {
      try {
        await stripe.customers.del(stripeID);
      } catch (delErr) {
        console.error(
          'completeOnboarding: failed to clean up orphan stripe customer:',
          stripeID,
          delErr instanceof Error ? delErr.message : 'unknown error'
        );
      }
    }
    // Unique-violation race on the username (someone took it between the
    // pre-check and the save) must surface the same actionable message as the
    // pre-check. Other unique violations fall through to the generic message.
    if (/unique|duplicate/i.test(msg) && /username/i.test(msg)) {
      return { message: 'That username is already taken. Please choose another one.' };
    }
    console.error(
      'Error saving profile:',
      stripeID
        ? `stripe customer created then cleaned up (id=${stripeID}) | ${msg || 'insert failed'}`
        : msg || 'Unknown error'
    );
    return { message: 'Failed to save your profile. Please try again.' };
  }

  revalidatePath('/', 'layout');
  // Profile is complete now: drop the pending flag so the middleware's
  // homepage -> dashboard auto-jump is restored.
  (await cookies()).delete(ONBOARDING_PENDING_COOKIE);
  redirect('/dashboard');
}

/**
 * Flags the session as "signed in, still owes onboarding". Called by
 * OnboardingForm on mount - the only place that both (a) can write cookies
 * (server action, unlike a server component render) and (b) runs exclusively
 * for users who have NOT completed onboarding (so no false positives like a
 * middleware stamp would hit when a completed user visits /onboarding and is
 * bounced to the dashboard). Covers legacy sessions that signed in before
 * the flag existed, without middleware ever needing to know onboarding state.
 */
export async function markOnboardingPending() {
  (await cookies()).set(ONBOARDING_PENDING_COOKIE, '1', onboardingPendingCookie);
}

export type UsernameAvailability = {
  status: 'available' | 'taken' | 'invalid' | 'error';
};

/**
 * Live availability check for the onboarding username field. Debounced by the
 * client as the user types; purely advisory - completeOnboarding and the DB
 * unique constraint remain the source of truth. Only rejects usernames held
 * by OTHER users so a pre-filled/own username always reports as available.
 *
 * This endpoint is intentionally public (username enumeration is inherent to
 * any signup UX that shows availability) and does one indexed lookup per
 * call; if it is ever abused, throttle at the proxy/edge rather than here.
 */
export async function checkUsernameAvailability(raw: string): Promise<UsernameAvailability> {
  const username = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { status: 'invalid' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const conflict = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        user
          ? and(eq(usersTable.username, username), ne(usersTable.id, user.id))
          : eq(usersTable.username, username)
      );

    return { status: conflict.length > 0 ? 'taken' : 'available' };
  } catch (err) {
    console.error(
      '[onboarding] availability check failed:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    // Advisory only: report 'error' so the form can show a neutral hint rather
    // than falsely claiming the username is taken/free.
    return { status: 'error' };
  }
}

function calculateAge(dob: string): number | null {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

export async function resetPassword(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();
  const password = formData.get('password');
  const confirmPassword = formData.get('confirm_password');
  const code = formData.get('code');

  // Server-side validation mirrors the client (never trust the browser):
  // fields must be strings, match, and meet the same 8-char floor the
  // settings password change enforces.
  if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
    return { message: 'Please fill in both password fields.' };
  }
  if (password !== confirmPassword) {
    return { message: 'Passwords do not match' };
  }
  if (password.length < 8) {
    return { message: 'Password must be at least 8 characters.' };
  }
  if (typeof code !== 'string' || code.length === 0) {
    return { message: 'This reset link is invalid or expired. Please request a new one.' };
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    // Expired/used one-time code - never proceed to updateUser on a stale session.
    return { message: 'This reset link is invalid or expired. Please request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { message: error.message };
  }
  redirect(`/forgot-password/reset/success`);
}

export async function forgotPassword(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();
  const rawEmail = formData.get('email');
  if (typeof rawEmail !== 'string' || !rawEmail.trim() || rawEmail.length > 254) {
    return { message: 'Please enter a valid email address.' };
  }
  const email = rawEmail.trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${PUBLIC_URL}/forgot-password/reset`,
  });

  if (error) {
    return { message: error.message };
  }
  redirect(`/forgot-password/success`);
}

export async function signup(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();

  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');
  const rawName = formData.get('name');
  if (
    typeof rawEmail !== 'string' ||
    typeof rawPassword !== 'string' ||
    typeof rawName !== 'string'
  ) {
    return { message: 'Please fill in all fields.' };
  }
  // Required Terms + Privacy consent: server-side gate (the checkbox in
  // SignupForm is `required`, but the browser is never trusted). The
  // timestamp lands in auth metadata so completeOnboarding can persist it to
  // the users row without asking OAuth users to consent twice.
  if (formData.get('termsConsent') !== 'true') {
    return { message: 'Please agree to the Terms of Service and Privacy Policy to continue.' };
  }
  const termsConsentedAt = new Date().toISOString();

  const data = {
    email: rawEmail.trim(),
    password: rawPassword,
    name: rawName.trim(),
  };

  // Server-side floors: never rely on the client form alone.
  if (!data.email || data.email.length > 254) {
    return { message: 'Please enter a valid email address.' };
  }
  if (data.password.length < 8) {
    return { message: 'Password must be at least 8 characters.' };
  }
  if (!data.name || data.name.length > 100) {
    return { message: 'Please enter your name (100 characters max).' };
  }

  // Check if user exists in our database first
  const existingDBUser = await db.select().from(usersTable).where(eq(usersTable.email, data.email));

  if (existingDBUser.length > 0) {
    return { message: 'An account with this email already exists. Please login instead.' };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${PUBLIC_URL}/auth/callback`,
      data: {
        email_confirm: process.env.NODE_ENV !== 'production',
        full_name: data.name,
        terms_consented_at: termsConsentedAt,
      },
    },
  });

  if (signUpError) {
    if (signUpError.message.includes('already registered')) {
      return { message: 'An account with this email already exists. Please login instead.' };
    }
    return { message: signUpError.message };
  }

  if (!signUpData?.user) {
    return { message: 'Failed to create user' };
  }

  // The users_table row (and its Stripe customer) is created later, by
  // completeOnboarding, once username, name and DOB have all been supplied -
  // sign-up itself only creates the auth account.
  (await cookies()).set(ONBOARDING_PENDING_COOKIE, '1', onboardingPendingCookie);
  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function loginUser(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();

  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');
  if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
    return { message: 'Please fill in all fields.' };
  }

  const data = {
    email: rawEmail.trim(),
    password: rawPassword,
  };
  if (!data.email || data.email.length > 254) {
    return { message: 'Please enter a valid email address.' };
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { message: error.message };
  }

  // Suspension is enforced server-side here (plus the dashboard layout and
  // requireAdmin): a suspended account may authenticate with Supabase, but
  // the app never lets the session go anywhere.
  const suspendedRows = await db
    .select({ suspendedAt: usersTable.suspended_at })
    .from(usersTable)
    .where(eq(usersTable.id, signInData.user.id));
  if (suspendedRows[0]?.suspendedAt) {
    await supabase.auth.signOut();
    return { message: 'This account has been suspended. Please contact support.' };
  }

  revalidatePath('/', 'layout');

  // New users (or anyone who never finished onboarding) set up their profile first.
  if (await hasCompletedOnboarding(signInData.user.id)) {
    // Drop any stale pending flag from an earlier unfinished session so the
    // homepage -> dashboard auto-jump comes back.
    (await cookies()).delete(ONBOARDING_PENDING_COOKIE);
    redirect('/dashboard');
  }
  // Flag the pending session BEFORE landing on /onboarding so the middleware
  // lets them leave the form (homepage stays reachable, no redirect loop).
  (await cookies()).set(ONBOARDING_PENDING_COOKIE, '1', onboardingPendingCookie);
  redirect('/onboarding');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Stale pending flag would outlive the session and silently disable the
  // homepage -> dashboard jump for the next user of this browser.
  (await cookies()).delete(ONBOARDING_PENDING_COOKIE);
  redirect('/login');
}

// Completes a Google sign-in performed client-side via Google Identity
// Services (signInWithIdToken). The session cookie is already written by the
// browser client before this action runs; we only need to validate the
// session and route to onboarding/dashboard (the users row is created by
// completeOnboarding, once every detail is filled in).
export async function finishGoogleSignIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/auth-code-error');
  }

  const bootstrapped = await bootstrapOAuthUser(user!);
  if (!bootstrapped.ok) {
    redirect('/auth/auth-code-error');
  }

  // Same suspension gate as loginUser: OAuth sessions are not exempt.
  const suspendedRows = await db
    .select({ suspendedAt: usersTable.suspended_at })
    .from(usersTable)
    .where(eq(usersTable.id, user!.id));
  if (suspendedRows[0]?.suspendedAt) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  revalidatePath('/', 'layout');

  // New users (or anyone who never finished onboarding) set up their profile first.
  if (await hasCompletedOnboarding(user!.id)) {
    (await cookies()).delete(ONBOARDING_PENDING_COOKIE);
    redirect('/dashboard');
  }
  (await cookies()).set(ONBOARDING_PENDING_COOKIE, '1', onboardingPendingCookie);
  redirect('/onboarding');
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${PUBLIC_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect('/auth/auth-code-error');
  }

  if (data.url) {
    redirect(data.url); // use the redirect API for your server framework
  } else {
    redirect('/auth/auth-code-error');
  }
}

export async function signInWithGithub() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${PUBLIC_URL}/auth/callback`,
    },
  });

  if (error) {
    redirect('/auth/auth-code-error');
  }

  if (data.url) {
    redirect(data.url); // use the redirect API for your server framework
  } else {
    redirect('/auth/auth-code-error');
  }
}
