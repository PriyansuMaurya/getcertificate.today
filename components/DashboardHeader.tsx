import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/server';
import DashboardHeaderProfileDropdown from './DashboardHeaderProfileDropdown';
import { getStripePlan } from '@/utils/stripe/api';
import { Suspense } from 'react';

export default async function DashboardHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stripePlan = user?.email ? await getStripePlan(user.email) : 'Free Explorer';

  return (
    <header className="sticky top-0 z-50 h-20 border-b border-sandline bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 xl:px-20">
        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/dashboard" className="flex shrink-0 items-center">
            <Image
              src="/figma/logo.png"
              alt="getcertificate.today"
              width={180}
              height={40}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>

          <Suspense
            fallback={
              <span className="hidden rounded-full border border-sandline bg-paper px-3 py-1 text-xs font-bold text-sand sm:inline-block">
                Loading...
              </span>
            }
          >
            <span className="hidden rounded-full border border-sand/40 bg-sand/15 px-3 py-1 text-xs font-bold text-ink sm:inline-block">
              {stripePlan === 'none' || !stripePlan ? 'Free Explorer' : stripePlan}
            </span>
          </Suspense>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/dashboard"
            className="text-[15px] font-semibold text-ink transition-colors hover:text-clay"
          >
            Dashboard
          </Link>
          <Link
            href="/subscribe"
            className="text-[15px] font-semibold text-clay transition-colors hover:text-ink"
          >
            Plans
          </Link>
          <Link
            href="/"
            className="text-[15px] font-semibold text-clay transition-colors hover:text-ink"
          >
            Home
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <DashboardHeaderProfileDropdown />
        </div>
      </div>
    </header>
  );
}
