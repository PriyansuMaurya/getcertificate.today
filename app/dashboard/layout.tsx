import DashboardHeader from '@/components/DashboardHeader';
import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { hasCompletedOnboarding } from '@/app/auth/actions';

export const metadata: Metadata = {
  title: 'Dashboard | getcertificate.today',
  description: 'Manage your YouTube learning credentials and achievements',
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
    <div className="flex min-h-screen flex-col">
      <DashboardHeader />
      {children}
    </div>
  );
}
