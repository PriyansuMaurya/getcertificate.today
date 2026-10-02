'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import DashboardNavLinks from './DashboardNavLinks';

/**
 * Mobile navigation for the dashboard header. Replaces the raw <details>
 * disclosure so the menu can be dismissed with Escape and outside clicks,
 * and so it closes automatically after navigating.
 */
export default function DashboardMobileNav() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      // Escape dismisses and returns focus to the trigger.
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
    <div ref={containerRef} className="relative lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Toggle dashboard navigation"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-linen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      {open && (
        // Clicks on nav links bubble here and close the menu after navigation.
        <div
          onClick={() => setOpen(false)}
          className="absolute left-0 top-12 z-50 w-64 rounded-lg border border-sandline bg-paper p-4 shadow-figma-hero"
        >
          <DashboardNavLinks />
        </div>
      )}
    </div>
  );
}
