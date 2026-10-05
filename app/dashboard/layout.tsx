import DashboardHeader from '@/components/DashboardHeader';
import DashboardSidebar from '@/components/DashboardSidebar';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { hasCompletedOnboarding } from '@/app/auth/onboarding-status';
import { requireActiveUser } from '@/utils/auth';

export const metadata: Metadata = {
  title: 'Dashboard | getcertificate.today',
  description: 'Manage your getcertificate.today account and subscription.',
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Sign-in + admin-suspension gate. This lives in app code rather than the
  // middleware proxy because the edge runtime cannot reach Postgres; it is
  // shared with the learner routes (utils/auth.ts) so the behaviour cannot
  // drift. Subscribing is a voluntary choice, never forced.
  const user = await requireActiveUser();

  // Users must complete onboarding before seeing the dashboard.
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
