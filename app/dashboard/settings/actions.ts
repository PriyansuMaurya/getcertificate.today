'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, ne } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable, credentialsTable, attemptsTable, learningItemsTable } from '@/utils/db/schema';

export type SettingsActionState = { message: string; success?: boolean };

/** Update profile fields editable after onboarding (FR-A5 extension). */
export async function updateProfile(
  _currentState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const username = (formData.get('username') as string | null)?.trim() ?? '';
  const firstName = (formData.get('firstName') as string | null)?.trim() ?? '';
  const lastName = (formData.get('lastName') as string | null)?.trim() ?? '';

  if (!username || !firstName || !lastName) {
    return { message: 'Username and name are required.' };
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return { message: 'Name must be 100 characters or fewer.' };
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return {
      message: 'Username must be 3-20 characters: lowercase letters, numbers, underscores only.',
    };
  }

  // Advisory pre-check; the unique constraint in the DB is the source of truth.
  const conflict = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.username, username), ne(usersTable.id, user.id)));
  if (conflict.length > 0) {
    return { message: 'That username is already taken. Please choose another one.' };
  }

  try {
    await db
      .update(usersTable)
      .set({ username, first_name: firstName, last_name: lastName })
      .where(eq(usersTable.id, user.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { message: 'That username is already taken. Please choose another one.' };
    }
    console.error('[settings] profile update failed:', msg || 'unknown error');
    return { message: 'Could not save your profile. Please try again.' };
  }

  revalidatePath('/', 'layout');
  return { message: 'Profile saved.', success: true };
}

/** Change password for email/password accounts (Supabase-managed). */
export async function changePassword(
  _currentState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const password = formData.get('password');
  const confirm = formData.get('confirm_password');

  if (typeof password !== 'string' || typeof confirm !== 'string') {
    return { message: 'Please fill in both password fields.' };
  }
  if (!password || !confirm) return { message: 'Please fill in both password fields.' };
  if (password !== confirm) return { message: 'Passwords do not match.' };
  if (password.length < 8) return { message: 'Password must be at least 8 characters.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { message: error.message };
  }

  return { message: 'Password updated.', success: true };
}

/**
 * One-click account deletion (GDPR art. 17 / CCPA deletion right).
 * Removes the profile row plus every owned record (learning items cascade to
 * assessments; attempts and credentials are deleted explicitly because their
 * FKs to users have no ON DELETE rule), then ends the session. NOTE: this
 * does NOT remove the Supabase Auth identity itself - admin deletion needs a
 * service-role key, which this project forbids (RULES §9), so the privacy
 * policy directs users to email us for that. Subscribers must cancel in the
 * billing portal first so a paid subscription is never orphaned.
 */
export async function deleteAccount(): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const profile = rows[0];
  if (!profile) {
    // No profile row yet (mid-onboarding): nothing app-side to delete.
    await supabase.auth.signOut();
    redirect('/');
  }

  if (profile.plan && profile.plan !== 'none') {
    return {
      message:
        'You have an active subscription. Cancel it in the billing portal first, then delete your account.',
    };
  }

  try {
    await db.delete(credentialsTable).where(eq(credentialsTable.user_id, user.id));
    await db.delete(attemptsTable).where(eq(attemptsTable.user_id, user.id));
    await db.delete(learningItemsTable).where(eq(learningItemsTable.user_id, user.id));
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  } catch (err) {
    console.error(
      '[settings] account deletion failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not delete your account. Please try again or contact support.' };
  }

  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
