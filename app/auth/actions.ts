'use server';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createStripeCustomer } from '@/utils/stripe/api';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq, or } from 'drizzle-orm';

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

// Profile is complete once onboarding has been filled in (username is required there).
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const rows = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return rows.length > 0 && rows[0].username !== null;
}

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
  const conflict = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, user.email!)));

  const usernameTaken = conflict.some((row) => row.id !== user.id);

  if (usernameTaken) {
    return { message: 'That username is already taken. Please choose another one.' };
  }

  try {
    await db
      .update(usersTable)
      .set({
        username,
        first_name: firstName,
        last_name: lastName,
        dob,
      })
      .where(eq(usersTable.id, user.id));
  } catch (err) {
    console.error('Error saving profile:', err instanceof Error ? err.message : 'Unknown error');
    return { message: 'Failed to save your profile. Please try again.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
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
  const passwordData = {
    password: formData.get('password') as string,
    confirm_password: formData.get('confirm_password') as string,
    code: formData.get('code') as string,
  };
  if (passwordData.password !== passwordData.confirm_password) {
    return { message: 'Passwords do not match' };
  }

  await supabase.auth.exchangeCodeForSession(passwordData.code);

  const { error } = await supabase.auth.updateUser({
    password: passwordData.password,
  });
  if (error) {
    return { message: error.message };
  }
  redirect(`/forgot-password/reset/success`);
}

export async function forgotPassword(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
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

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    name: formData.get('name') as string,
  };

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

  try {
    // create Stripe Customer Record using signup response data
    const stripeID = await createStripeCustomer(
      signUpData.user.id,
      signUpData.user.email!,
      data.name
    );

    // Create record in DB
    await db.insert(usersTable).values({
      id: signUpData.user.id,
      name: data.name,
      email: signUpData.user.email!,
      stripe_id: stripeID,
      plan: 'none',
    });
  } catch (err) {
    console.error('Error in signup:', err instanceof Error ? err.message : 'Unknown error');
    return { message: 'Failed to setup user account' };
  }

  revalidatePath('/', 'layout');
  redirect('/onboarding');
}

export async function loginUser(currentState: { message: string }, formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { data: signInData, error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { message: error.message };
  }

  revalidatePath('/', 'layout');

  // New users (or anyone who never finished onboarding) set up their profile first.
  if (await hasCompletedOnboarding(signInData.user.id)) {
    redirect('/dashboard');
  }
  redirect('/onboarding');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
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
