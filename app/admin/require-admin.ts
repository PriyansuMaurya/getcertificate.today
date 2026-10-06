import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isAdminUser } from '@/utils/auth';

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
 * - Signed in without an admin role (isAdminUser) -> notFound(). A 404 (not
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

  // The role + suspension rule lives in isAdminUser() so the admin console and
  // the certificate/OG gates can't drift. A suspended admin also loses console
  // access (defense in depth: login and the dashboard layout are the primary
  // suspension gates).
  if (!(await isAdminUser(user.id))) {
    notFound();
  }

  return user;
}
