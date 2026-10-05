'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { usersTable, credentialsTable, attemptsTable, learningItemsTable } from '@/utils/db/schema';
import { requireAdmin } from '../require-admin';
import { safeAdminReturnPath, withDeletedNotice } from '../return-path';

export type AdminUserActionState = { message: string; success?: boolean };

/**
 * Shared authorization for user-moderation actions. Every action in this
 * module starts here: requireAdmin() redirects signed-out callers to /login
 * and 404s non-admins (and suspended admins) before any mutation runs, so
 * hiding the buttons in the UI is never the security boundary.
 *
 * Guards beyond authorization:
 * - admins cannot moderate their own account (no self-lockout / self-delete)
 * - target must exist
 */
async function authorizeTarget(
  userId: string
): Promise<AdminUserActionState | { userId: string; role: string }> {
  // Ids are opaque text (uuid-like); bound the length so an oversized payload
  // never reaches the query builder.
  if (!userId || userId.length > 128) {
    return { message: 'Missing or invalid user id.' };
  }

  const admin = await requireAdmin();
  if (admin.id === userId) {
    return { message: 'You cannot moderate your own account.' };
  }

  const rows = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (rows.length === 0) {
    return { message: 'That account no longer exists.' };
  }

  return { userId, role: rows[0].role };
}

function targetOf(formData: FormData): string {
  return (formData.get('userId') as string | null)?.trim() ?? '';
}

/** Suspend an account: sets users_table.suspended_at. Reversible. */
export async function suspendUser(
  _currentState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const userId = targetOf(formData);
  const auth = await authorizeTarget(userId);
  if ('message' in auth) return auth; // Moderating another admin is restricted to keep a single compromised
  // admin from locking the whole team out; do it directly in SQL instead.
  if (auth.role === 'admin') {
    return { message: 'Admin accounts cannot be suspended from the console.' };
  }

  try {
    await db.update(usersTable).set({ suspended_at: new Date() }).where(eq(usersTable.id, userId));
  } catch (err) {
    console.error('[admin] suspend failed:', err instanceof Error ? err.message : 'unknown error');
    return { message: 'Could not suspend this account. Please try again.' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { message: 'Account suspended. They are signed out and cannot sign in.', success: true };
}

/** Lift a suspension: sets users_table.suspended_at back to null. */
export async function unsuspendUser(
  _currentState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const userId = targetOf(formData);
  const auth = await authorizeTarget(userId);
  if ('message' in auth) return auth;

  try {
    await db.update(usersTable).set({ suspended_at: null }).where(eq(usersTable.id, userId));
  } catch (err) {
    console.error(
      '[admin] unsuspend failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not restore this account. Please try again.' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { message: 'Account restored. They can sign in again.', success: true };
}

/**
 * Permanently delete a user's app-side data: profile row plus every owned
 * record (learning items cascade to assessments; attempts and credentials are
 * deleted explicitly because their FKs to users have no ON DELETE rule -
 * same order as deleteAccount in app/dashboard/settings/actions.ts).
 *
 * NOTE: this does NOT remove the Supabase Auth identity itself - that needs a
 * service-role key, which this project forbids (RULES §9). The account row is
 * gone, so the user would re-onboard if they signed in again; document that
 * when this action is surfaced.
 */
export async function deleteUser(
  _currentState: AdminUserActionState,
  formData: FormData
): Promise<AdminUserActionState> {
  const userId = targetOf(formData);
  const auth = await authorizeTarget(userId);
  if ('message' in auth) return auth;

  // Confirmation is enforced server-side, not only by the two-step dialog: a
  // deletion request that does not carry the acknowledgement is refused.
  if (formData.get('confirm') !== 'yes') {
    return { message: 'Confirmation required to delete an account.' };
  }

  if (auth.role === 'admin') {
    return { message: 'Admin accounts cannot be deleted from the console.' };
  }

  try {
    await db.delete(credentialsTable).where(eq(credentialsTable.user_id, userId));
    await db.delete(attemptsTable).where(eq(attemptsTable.user_id, userId));
    await db.delete(learningItemsTable).where(eq(learningItemsTable.user_id, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  } catch (err) {
    console.error('[admin] delete failed:', err instanceof Error ? err.message : 'unknown error');
    return { message: 'Could not delete this account. Please try again.' };
  }

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  // The deleted row unmounts on revalidation, so a row-level success message
  // would go with it. Redirect back to the list instead (filters preserved),
  // where AdminNotice confirms the deletion.
  redirect(withDeletedNotice(safeAdminReturnPath(formData.get('returnTo'), '/admin/users')));
}
