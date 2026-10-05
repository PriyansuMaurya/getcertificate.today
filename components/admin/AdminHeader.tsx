import Image from 'next/image';
import Link from 'next/link';
import DashboardHeaderProfileDropdown from '@/components/DashboardHeaderProfileDropdown';
import AdminMobileNav from './AdminMobileNav';

// Admin console header. Mirrors DashboardHeader (sticky h-20, border-b,
// bg-cream/95 backdrop-blur) with the quick search replaced by the mobile nav
// disclosure below lg (the sidebar owns navigation from lg up). The email is
// passed in by the layout - requireAdmin() already proved the session, so no
// second auth round-trip happens here.
export default function AdminHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-40 h-20 border-b border-sandline bg-cream/95 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AdminMobileNav />
          <Link
            href="/admin"
            aria-label="getcertificate.today admin overview"
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
          <span className="hidden truncate text-sm font-semibold text-clay md:inline">{email}</span>
        </div>

        <Link
          href="/dashboard"
          className="hidden text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay sm:inline"
        >
          User dashboard
        </Link>
        <DashboardHeaderProfileDropdown />
      </div>
    </header>
  );
}
