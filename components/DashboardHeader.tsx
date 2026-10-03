import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import DashboardHeaderProfileDropdown from './DashboardHeaderProfileDropdown';
import DashboardQuickSearch from './DashboardQuickSearch';
import { getStripePlan } from '@/utils/stripe/api';

export default async function DashboardHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let stripePlan = 'Plan unavailable';
  if (user?.email) {
    try {
      const plan = await getStripePlan(user.email);
      stripePlan = plan === 'none' || !plan ? 'Free Explorer' : plan;
    } catch (error) {
      console.error(
        'Dashboard plan lookup failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-sandline bg-cream/95 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <DashboardQuickSearch />
          <span className="hidden rounded-full border border-sandline bg-paper px-3 py-1 text-xs font-bold text-clay md:inline-flex">
            {stripePlan === 'none' || !stripePlan ? 'Free Explorer' : stripePlan}
          </span>
        </div>

        <Link
          href="/subscribe"
          className="hidden text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay sm:inline"
        >
          Plans
        </Link>
        <DashboardHeaderProfileDropdown />
      </div>
    </header>
  );
}
