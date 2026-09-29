import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, BookOpen, LayoutDashboard, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Learning', icon: BookOpen },
  { label: 'Certificates', icon: BadgeCheck },
  { label: 'Settings', icon: Settings },
];

export function DashboardNavLinks() {
  return (
    <nav aria-label="Dashboard navigation" className="flex flex-col gap-2">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) =>
        href ? (
          <Link
            key={label}
            href={href}
            aria-current="page"
            className="flex h-11 items-center gap-3 rounded-lg bg-linen px-4 text-sm font-bold text-ink"
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {label}
          </Link>
        ) : (
          <span
            key={label}
            aria-disabled="true"
            title="Not available yet"
            className="flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold text-clay"
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {label}
          </span>
        )
      )}
    </nav>
  );
}

export default function DashboardSidebar() {
  return (
    <aside
      aria-label="Dashboard navigation"
      className="hidden min-h-screen w-[280px] shrink-0 border-r border-sandline bg-paper lg:block"
    >
      <div className="sticky top-0 flex h-screen flex-col px-8 py-8">
        <Link href="/dashboard" aria-label="getcertificate.today dashboard">
          <Image
            src="/figma/logo.png"
            alt="getcertificate.today"
            width={180}
            height={40}
            priority
            className="h-10 w-[180px]"
          />
        </Link>
        <div className="mt-12">
          <DashboardNavLinks />
        </div>
      </div>
    </aside>
  );
}
