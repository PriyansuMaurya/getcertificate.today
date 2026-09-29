import DashboardHeader from '@/components/DashboardHeader';
import DashboardSidebar from '@/components/DashboardSidebar';
import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { hasCompletedOnboarding } from '@/app/auth/actions';

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

  if (!(await hasCompletedOnboarding(user.id))) {
    redirect('/onboarding');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <DashboardSidebar />
      <div className="min-w-0">
        <DashboardHeader />
        {children}
      </div>
    </div>
  );
}
