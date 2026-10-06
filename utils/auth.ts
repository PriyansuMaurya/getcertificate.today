// Server-only account-state helpers shared by the learner routes/actions, the
// admin guard (requireAdmin), and the certificate page / OG-image gates.
//
// Admin suspension is written to users_table.suspended_at by
// app/admin/users/actions.ts. It is enforced at login, OAuth sign-in, the
// dashboard layout, and requireAdmin() - but the middleware proxy cannot reach
// Postgres, so /learn routes and their server actions need their own check.
// Without it a suspended account with an already-open session could keep
// watching and minting credentials.
//
// NOT a 'use server' file: its exports must stay internal, not become public
// endpoints (same rule as app/auth/onboarding-status.ts and
// app/admin/require-admin.ts).
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';

/** Shared copy for a suspended account (matches app/auth/actions.ts). */
export const SUSPENDED_MESSAGE = 'This account has been suspended. Please contact support.';

/** True while the account row is suspended. A missing row is treated as active here. */
export async function isAccountSuspended(userId: string): Promise<boolean> {
  const rows = await db
    .select({ suspendedAt: usersTable.suspended_at })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return Boolean(rows[0]?.suspendedAt);
}

/**
 * True only when the user's row has role 'admin' and is not suspended. The rule
 * lives in one place so the admin console (requireAdmin) and the certificate
 * page / OG-image gates can't drift apart. The role is read server-side from the
 * database on every call - nothing the client sends can influence it.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: usersTable.role, suspendedAt: usersTable.suspended_at })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return rows[0]?.role === 'admin' && rows[0]?.suspendedAt === null;
}

/**
 * Resolves the signed-in user for a learner page, ending the session and
 * redirecting to /login when the account is suspended - the same treatment the
 * dashboard layout applies, so an admin suspension takes effect on every
 * learner route, not just /dashboard.
 */
export async function requireActiveUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  if (await isAccountSuspended(user.id)) {
    // Best-effort session end: cookie writes are swallowed inside Server
    // Components (utils/supabase/server.ts), so the redirect below is the
    // actual gate. Denial never depends on the sign-out succeeding.
    await supabase.auth.signOut();
    redirect('/login');
  }

  return user;
}
