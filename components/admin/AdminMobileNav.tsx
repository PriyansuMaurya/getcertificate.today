'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { ADMIN_NAV_ITEMS, isActive } from './AdminNavLinks';

// Mobile disclosure for the admin sidebar: the sidebar is lg+ only, so below
// that breakpoint the nav lives in this header dropdown. Escape and
// outside-click dismiss, same contract as the landing page MobileNav.
export default function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Toggle admin navigation"
        aria-expanded={open}
        aria-controls="admin-mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-linen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        {open ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Menu aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {open && (
        <nav
          id="admin-mobile-nav"
          aria-label="Admin navigation"
          className="absolute inset-x-0 top-full z-50 flex flex-col gap-2 border-b border-sandline bg-cream px-6 pb-6 pt-4 shadow-figma-pro"
        >
          {ADMIN_NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={label}
                href={href}
                // Closing here (not in an effect) covers navigation: picking a
                // link dismisses the panel so it never covers the target page.
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'flex h-11 items-center gap-3 rounded-lg bg-linen px-4 text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream'
                    : 'flex h-11 items-center gap-3 rounded-lg px-4 text-sm font-semibold text-ink transition-colors hover:bg-linen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream'
                }
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
