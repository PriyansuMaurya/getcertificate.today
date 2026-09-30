import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import DashboardHeaderProfileDropdown from './DashboardHeaderProfileDropdown';
import DashboardQuickSearch from './DashboardQuickSearch';
import { getStripePlan } from '@/utils/stripe/api';
import { Menu } from 'lucide-react';
import DashboardNavLinks from './DashboardNavLinks';

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
        <details className="relative lg:hidden">
          <summary
            aria-label="Open dashboard navigation"
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </summary>
          <div className="absolute left-0 top-12 z-50 w-64 rounded-lg border border-sandline bg-paper p-4 shadow-figma-hero">
            <DashboardNavLinks />
          </div>
        </details>

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
