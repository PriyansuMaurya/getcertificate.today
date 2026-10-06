import Image from 'next/image';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { planLabel } from '@/utils/plans';
import DashboardHeaderProfileDropdown from './DashboardHeaderProfileDropdown';
import DashboardQuickSearch from './DashboardQuickSearch';

export default async function DashboardHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Plan label from the locally stored entitlement key (utils/plans.ts) - no
  // Stripe round-trip needed.
  let plan = 'Free';
  if (user) {
    try {
      const rows = await db
        .select({ plan: usersTable.plan })
        .from(usersTable)
        .where(eq(usersTable.id, user.id));
      plan = planLabel(rows[0]?.plan);
    } catch (error) {
      console.error(
        'Dashboard plan lookup failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      plan = 'Plan unavailable';
    }
  }

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-sandline bg-cream/95 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="getcertificate.today dashboard"
            className="hidden shrink-0 max-[634.98px]:block"
          >
            <Image
              src="/figma/logo-no-tagline.svg"
              alt="getcertificate.today"
              width={1339}
              height={767}
              priority
              unoptimized
              className="h-9 w-auto"
            />
          </Link>
          <DashboardQuickSearch />
          <span className="hidden rounded-full border border-sandline bg-paper px-3 py-1 text-xs font-bold text-clay md:inline-flex">
            {plan}
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
