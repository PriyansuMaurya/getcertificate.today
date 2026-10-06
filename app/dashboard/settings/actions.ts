'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable, credentialsTable, attemptsTable, learningItemsTable } from '@/utils/db/schema';

const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';

export type SettingsActionState = { message: string; success?: boolean };

/**
 * Update the profile fields editable after onboarding (FR-A5 extension).
 * Email and username are shown read-only in Settings, so only the name is
 * written here - the form intentionally does not submit a username.
 */
export async function updateProfile(
  _currentState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const firstName = (formData.get('firstName') as string | null)?.trim() ?? '';
  const lastName = (formData.get('lastName') as string | null)?.trim() ?? '';

  if (!firstName || !lastName) {
    return { message: 'First name and surname are required.' };
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return { message: 'Name must be 100 characters or fewer.' };
  }

  try {
    await db
      .update(usersTable)
      .set({ first_name: firstName, last_name: lastName })
      .where(eq(usersTable.id, user.id));
  } catch (err) {
    console.error(
      '[settings] profile update failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not save your profile. Please try again.' };
  }

  revalidatePath('/', 'layout');
  return { message: 'Profile saved.', success: true };
}

/**
 * Emails a password reset link for the signed-in user (Supabase-managed).
 * Mirrors forgotPassword() but sources the address from the session so the
 * user never has to retype it, and reports inline instead of redirecting away
 * from Settings.
 */
export async function sendPasswordResetEmail(): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!user.email) {
    return { message: 'Your account has no email address. Please contact support.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${PUBLIC_URL}/forgot-password/reset`,
  });
  if (error) {
    console.error('[settings] password reset email failed:', error.message);
    return { message: 'Could not send the reset email. Please try again.' };
  }

  return {
    message: `We emailed a password reset link to ${user.email}.`,
    success: true,
  };
}

/**
 * Change password for email/password accounts (Supabase-managed).
 * Requires the current password: updateUser({ password }) alone would let
 * anyone holding a hijacked session take over the account, so we re-verify the
 * current password with signInWithPassword first. Social-only accounts have no
 * password to confirm and are pointed at the reset-link flow instead.
 */
export async function changePassword(
  _currentState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const currentPassword = formData.get('current_password');
  const password = formData.get('password');
  const confirm = formData.get('confirm_password');

  if (
    typeof currentPassword !== 'string' ||
    typeof password !== 'string' ||
    typeof confirm !== 'string' ||
    !currentPassword ||
    !password ||
    !confirm
  ) {
    return { message: 'Please fill in all password fields.' };
  }
  if (password !== confirm) return { message: 'Passwords do not match.' };
  if (password.length < 8) return { message: 'Password must be at least 8 characters.' };

  if (!user.email) {
    return { message: 'Your account has no email address. Please contact support.' };
  }

  // Verify the current password before allowing the change - updateUser({ password })
  // alone would let anyone holding a hijacked session take over the account.
  // Side effect: this refreshes the session cookies, harmless for the signed-in user.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    if (verifyError.code !== 'invalid_credentials') {
      console.error('[settings] current-password verification failed:', verifyError.message);
    }
    // A social-only account has no password to confirm. Classified here (not
    // before verifying) so an unpopulated identities array can never block a
    // real email/password user whose password is correct.
    const hasPasswordIdentity =
      user.identities?.some((identity) => identity.provider === 'email') ?? false;
    if (!hasPasswordIdentity) {
      return {
        message:
          'Your account signs in with a social provider. Use "Email me a reset link" below to set a password.',
      };
    }
    return { message: 'Current password is incorrect.' };
  }

  // Checked after verification so a wrong "current" still reads as incorrect
  // rather than as a reused password.
  if (password === currentPassword) {
    return { message: 'Your new password must be different from your current password.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { message: error.message };
  }

  // End every session for this account, including this device: a password change
  // is exactly when a hijacked session must be ejected, so scope 'global' (not
  // 'others'). signOut() clears the local session even when the server call
  // fails, so either way the user lands on the login page and signs back in with
  // the new password. A failed server-side revocation is surfaced there as a
  // warning rather than silently swallowed.
  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError) {
    console.error('[settings] post-change sign-out failed:', signOutError.message);
    redirect('/login?passwordChanged=1&signOutFailed=1');
  }

  redirect('/login?passwordChanged=1');
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
