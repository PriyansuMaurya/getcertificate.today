import DashboardHeader from '@/components/DashboardHeader';
import DashboardSidebar from '@/components/DashboardSidebar';
import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { hasCompletedOnboarding } from '@/app/auth/onboarding-status';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';

export const metadata: Metadata = {
  title: 'Dashboard | getcertificate.today',
  description: 'Manage your getcertificate.today account and subscription.',
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Users must complete onboarding before seeing the dashboard.
  // Subscribing is a voluntary choice made inside the dashboard, never forced.
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Suspension enforcement: end the session on any dashboard request so a
  // suspended account cannot keep using an already-open session. This lives
  // in layouts/actions rather than the middleware proxy because the edge
  // runtime cannot reach Postgres; routes that never render this layout are
  // covered by the login and requireAdmin gates instead.
  const suspensionRows = await db
    .select({ suspendedAt: usersTable.suspended_at })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));
  if (suspensionRows[0]?.suspendedAt) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  if (!(await hasCompletedOnboarding(user.id))) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Keyboard/screen-reader bypass for the sidebar + header chrome. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-cream focus:shadow-figma-pro"
      >
        Skip to main content
      </a>
      <DashboardSidebar />
      <div className="min-w-0">
        <DashboardHeader />
        {children}
      </div>
    </div>
  );
}
