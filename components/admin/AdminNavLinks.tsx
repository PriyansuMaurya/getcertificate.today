'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, ClipboardCheck, Gauge, Settings, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ADMIN_NAV_ITEMS: {
  label: string;
  href: string;
  icon: LucideIcon;
  exact: boolean;
}[] = [
  { label: 'Overview', href: '/admin', icon: Gauge, exact: true },
  { label: 'Users', href: '/admin/users', icon: Users, exact: false },
  { label: 'Assessments', href: '/admin/assessments', icon: ClipboardCheck, exact: false },
  { label: 'Credentials', href: '/admin/credentials', icon: BadgeCheck, exact: false },
  { label: 'Settings', href: '/admin/settings', icon: Settings, exact: false },
];

export function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="flex flex-col gap-2">
      {ADMIN_NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'flex h-11 items-center gap-3 rounded-lg bg-linen px-4 text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
                : 'flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold text-clay transition-colors hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
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
