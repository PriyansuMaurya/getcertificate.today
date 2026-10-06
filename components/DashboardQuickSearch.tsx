'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, CornerDownLeft } from 'lucide-react';

type Destination = {
  label: string;
  description: string;
  href: string;
  keywords: string;
};

const DESTINATIONS: Destination[] = [
  {
    label: 'Dashboard',
    description: 'Overview & quick stats',
    href: '/dashboard',
    keywords: 'home overview welcome',
  },
  {
    label: 'My Learning',
    description: 'Your YouTube courses',
    href: '/dashboard/learning',
    keywords: 'courses videos progress learn',
  },
  {
    label: 'Certificates',
    description: 'Earned credentials',
    href: '/dashboard/certificates',
    keywords: 'credentials awards badges proof',
  },
  {
    label: 'Settings',
    description: 'Profile, password, billing',
    href: '/dashboard/settings',
    keywords: 'account profile password plan billing',
  },
  {
    label: 'Plans & Pricing',
    description: 'Compare plans & pricing',
    href: '/subscribe',
    keywords: 'upgrade starter pro subscription price',
  },
];

export default function DashboardQuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [rawActiveIndex, setRawActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter(
      (d) =>
        d.label.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.keywords.includes(q)
    );
  }, [query]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Ctrl/Cmd+K focuses search, a common dashboard convention.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Clamp instead of resetting via an effect (react-hooks/set-state-in-effect).
  const activeIndex = Math.min(rawActiveIndex, Math.max(results.length - 1, 0));

  function go(dest: Destination) {
    setOpen(false);
    setQuery('');
    router.push(dest.href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setRawActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRawActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) go(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative hidden max-w-[420px] flex-1 sm:block">
      <div className="flex items-center gap-3 rounded-lg border border-sandline bg-paper px-4 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-clay" />
        <label htmlFor="dashboard-quick-search" className="sr-only">
          Search dashboard pages
        </label>
        <input
          ref={inputRef}
          id="dashboard-quick-search"
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="dashboard-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[activeIndex] ? `search-result-${activeIndex}` : undefined
          }
          placeholder="Search pages… (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setRawActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-full w-full bg-transparent py-3 text-sm text-ink placeholder:text-clay/70 focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded border border-sandline bg-cream px-1.5 py-0.5 text-[10px] font-bold text-clay lg:inline">
          ⌘K
        </kbd>
      </div>

      {open && (
        <ul
          id="dashboard-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-sandline bg-paper p-1.5 shadow-figma-pro"
        >
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-clay">No pages match “{query}”.</li>
          )}
          {results.map((dest, i) => (
            <li key={dest.href} role="presentation">
              <button
                type="button"
                id={`search-result-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                onMouseEnter={() => setRawActiveIndex(i)}
                onClick={() => go(dest)}
                className={
                  i === activeIndex
                    ? 'flex w-full items-center gap-3 rounded-md bg-cream px-3 py-2.5 text-left'
                    : 'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left'
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {dest.label}
                  </span>
                  <span className="block truncate text-xs text-clay">{dest.description}</span>
                </span>
                {i === activeIndex ? (
                  <CornerDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-clay" />
                ) : (
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-clay" />
                )}
              </button>
            </li>
          ))}
          <li className="mt-1 border-t border-sandline px-3 pb-1 pt-2 text-[11px] text-clay">
            Type to filter · ↑↓ to move · Enter to open · Esc to close
          </li>
        </ul>
      )}
    </div>
  );
}
