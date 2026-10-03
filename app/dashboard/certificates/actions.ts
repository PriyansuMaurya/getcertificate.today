'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { credentialsTable } from '@/utils/db/schema';

export type CredentialActionState = { message: string; success?: boolean };

/**
 * Owner-initiated revocation (FR-E5). Flips `status` only - hashed fields and
 * the record itself are never edited (RULES §18.4).
 */
export async function revokeCredential(
  _currentState: CredentialActionState,
  formData: FormData
): Promise<CredentialActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const credentialId = formData.get('credentialId') as string | null;
  if (!credentialId) return { message: 'Missing credential.' };

  const rows = await db
    .select({ id: credentialsTable.id, status: credentialsTable.status })
    .from(credentialsTable)
    .where(and(eq(credentialsTable.id, credentialId), eq(credentialsTable.user_id, user.id)));
  if (rows.length === 0) return { message: 'That credential was not found.' };
  if (rows[0].status === 'revoked') return { message: 'This credential is already revoked.' };

  await db
    .update(credentialsTable)
    .set({ status: 'revoked' })
    .where(eq(credentialsTable.id, credentialId));

  revalidatePath('/dashboard/certificates');
  revalidatePath(`/certificates/${credentialId}`);
  revalidatePath(`/verify/${credentialId}`);
  return { message: 'Credential revoked.', success: true };
}
