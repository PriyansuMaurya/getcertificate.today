'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

// Mobile navigation disclosure for the landing navbar.
// Desktop (lg+) is unchanged — links render in the header bar per the Figma design.
const LINKS = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Sign In', href: '/login' },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <nav className="absolute inset-x-0 top-full z-50 flex flex-col border-b border-sandline bg-cream px-6 pb-6 pt-2 shadow-figma-pro">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="py-3 text-[15px] font-semibold text-ink"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/signup"
            onClick={() => setOpen(false)}
            className="mt-2 flex h-12 items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream"
          >
            Get Started
          </Link>
        </nav>
      )}
    </div>
  );
}
