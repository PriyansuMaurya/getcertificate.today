import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';

// Deliberately NOT in a 'use server' file: every export of a server-actions
// module becomes a publicly callable endpoint. This helper takes a userId and
// must stay an internal server-only function (server components + actions).

// Profile is complete once every onboarding field is filled in. Username and
// names may be pre-filled from the OAuth provider profile at bootstrap, but DOB
// is never provided by Google/GitHub - so a non-null dob (plus the other
// required fields) is what proves onboarding actually finished.
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const rows = await db
    .select({
      username: usersTable.username,
      firstName: usersTable.first_name,
      lastName: usersTable.last_name,
      dob: usersTable.dob,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (rows.length === 0) return false;
  const r = rows[0];
  return r.username !== null && r.firstName !== null && r.lastName !== null && r.dob !== null;
}
