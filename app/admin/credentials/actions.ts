'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { credentialsTable } from '@/utils/db/schema';
import { requireAdmin } from '../require-admin';
import { safeAdminReturnPath, withDeletedNotice } from '../return-path';

export type AdminCredentialActionState = { message: string; success?: boolean };

/**
 * Shared authorization for credential-moderation actions. Every action in this
 * module starts here: requireAdmin() redirects signed-out callers to /login and
 * 404s non-admins (and suspended admins) before any mutation runs, so hiding
 * the buttons in the UI is never the security boundary.
 */
async function authorizeCredential(
  credentialId: string
): Promise<AdminCredentialActionState | { credentialId: string; userId: string; status: string }> {
  // Ids are opaque text; bound the length so an oversized payload never reaches
  // the query builder.
  if (!credentialId || credentialId.length > 128) {
    return { message: 'Missing or invalid credential id.' };
  }

  await requireAdmin();

  const rows = await db
    .select({
      id: credentialsTable.id,
      userId: credentialsTable.user_id,
      status: credentialsTable.status,
    })
    .from(credentialsTable)
    .where(eq(credentialsTable.id, credentialId));
  if (rows.length === 0) {
    return { message: 'That credential no longer exists.' };
  }

  return { credentialId, userId: rows[0].userId, status: rows[0].status };
}

function targetOf(formData: FormData): string {
  return (formData.get('credentialId') as string | null)?.trim() ?? '';
}

/** Every surface a credential change can show up on. */
function revalidateCredentialSurfaces(credentialId: string, userId: string) {
  revalidatePath('/admin/credentials');
  revalidatePath('/admin');
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/dashboard/certificates');
  revalidatePath(`/certificates/${credentialId}`);
  revalidatePath(`/verify/${credentialId}`);
}

/**
 * Revoke an issued credential: flips `status` to 'revoked' only. The hashed
 * fields and the record itself are never edited (RULES §18.4), so the
 * tamper-evident hash stays valid and the public record shows as revoked.
 * Reversible only by re-issuing, so the caller must acknowledge it.
 */
export async function revokeCredential(
  _currentState: AdminCredentialActionState,
  formData: FormData
): Promise<AdminCredentialActionState> {
  const credentialId = targetOf(formData);
  const auth = await authorizeCredential(credentialId);
  if ('message' in auth) return auth;

  // Confirmation is enforced server-side, not only by the two-step dialog.
  if (formData.get('confirm') !== 'yes') {
    return { message: 'Confirmation required to revoke a credential.' };
  }

  if (auth.status === 'revoked') {
    return { message: 'This credential is already revoked.' };
  }

  try {
    await db
      .update(credentialsTable)
      .set({ status: 'revoked' })
      .where(eq(credentialsTable.id, credentialId));
  } catch (err) {    console.error(
      '[admin] credential revoke failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not revoke this credential. Please try again.' };
  }

  revalidateCredentialSurfaces(credentialId, auth.userId);
  return {
    message: 'Credential revoked. The public record now shows it as revoked.',
    success: true,
  };
}

/**
 * Permanently delete a credential row. Nothing references credentials (they
 * point at attempts, not the other way round), so this is a single-row delete.
 * Destructive: the public certificate page and the verification page will stop
 * resolving, so the caller must acknowledge it.
 */
export async function deleteCredential(
  _currentState: AdminCredentialActionState,
  formData: FormData
): Promise<AdminCredentialActionState> {
  const credentialId = targetOf(formData);
  const auth = await authorizeCredential(credentialId);
  if ('message' in auth) return auth;

  // Confirmation is enforced server-side, not only by the two-step dialog.
  if (formData.get('confirm') !== 'yes') {
    return { message: 'Confirmation required to delete a credential.' };
  }

  try {
    await db.delete(credentialsTable).where(eq(credentialsTable.id, credentialId));
  } catch (err) {    console.error(
      '[admin] credential delete failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not delete this credential. Please try again.' };
  }

  revalidateCredentialSurfaces(credentialId, auth.userId);
  // The deleted row unmounts on revalidation, so a row-level success message
  // would go with it. Redirect back to the list (filters preserved), where
  // AdminNotice confirms the deletion.
  redirect(
    withDeletedNotice(safeAdminReturnPath(formData.get('returnTo'), '/admin/credentials'))
  );
}
