'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, BookOpen, Gift, LayoutDashboard, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'My Learning', href: '/dashboard/learning', icon: BookOpen, exact: false },
  { label: 'Certificates', href: '/dashboard/certificates', icon: BadgeCheck, exact: false },
  { label: 'Referrals', href: '/dashboard/referrals', icon: Gift, exact: false },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardNavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation" className="flex flex-col gap-2">
      {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex h-11 items-center gap-3 rounded-lg bg-linen px-4 text-sm font-bold text-ink'
                : 'flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold text-clay transition-colors hover:bg-cream hover:text-ink'
            }
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
