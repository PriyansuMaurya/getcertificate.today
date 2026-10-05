import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';

// Deliberately NOT in a 'use server' file: every export of a server-actions
// module becomes a publicly callable endpoint (same rule as
// app/auth/onboarding-status.ts). This is an internal server-only guard used
// by admin layouts/pages/actions.

/**
 * Authorization gate for the /admin area.
 *
 * - Signed out  -> redirect('/login'). The middleware already bounces
 *   anonymous /admin hits; this is defense in depth for direct RSC/action
 *   requests.
 * - Signed in without users_table.role = 'admin' -> notFound(). A 404 (not
 *   403) so the console never confirms it exists to regular users.
 * - Signed in admin -> resolves to the Supabase user.
 *
 * The role is read server-side from the database on every call; nothing the
 * client sends can influence it.
 *
 * Called from BOTH the admin layout and each admin page on purpose: shared
 * layouts can be reused across client navigations, while pages always render
 * server-side (and are the surface server actions attach to). The extra query
 * is the price for neither path being able to skip the check.
 *
 * Resolves to the Supabase user so future admin server actions/pages can use
 * the identity (e.g. attribute audit-log entries) without a second auth call.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  // A forged/malformed auth cookie can make getUser() throw; treat that as
  // signed out rather than letting it surface as a 500. (Defense in depth - the
  // middleware already normalizes this for the normal document request path.)
  const user = await supabase.auth
    .getUser()
    .then(({ data }) => data.user)
    .catch(() => null);

  if (!user) {
    redirect('/login');
  }

  const rows = await db
    .select({ role: usersTable.role, suspendedAt: usersTable.suspended_at })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));

  // A suspended admin also loses console access (defense in depth: the login
  // and dashboard checks below are the primary suspension gates).
  if (rows[0]?.role !== 'admin' || rows[0]?.suspendedAt !== null) {
    notFound();
  }

  return user;
}
