'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

/** Format a date the way the label should read: "June 15, 1995". */
function formatDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Local-timezone yyyy-mm-dd (avoid Date#toISOString, which shifts by tz). */
function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a yyyy-mm-dd string into a local Date, or null when invalid. */
function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function DateOfBirthField({
  value,
  onChange,
}: {
  value: string;
  onChange: (isoDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const today = new Date();
  // DOB picker bounds: the last 100 years, and no later than 13 years ago so
  // the calendar itself enforces the server's minimum-age rule (no guaranteed
  // "must be at least 13" round-trip error after picking).
  const startDay = new Date(today.getFullYear() - 100, today.getMonth(), 1);
  const lastAllowedDay = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id="dob"
            className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-sandline bg-cream px-3.5 text-left text-sm text-ink transition-colors hover:border-clay/40 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          >
            <span className={selected ? undefined : 'text-clay/60'}>
              {selected ? formatDisplay(selected) : 'Select your date of birth'}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto bg-cream p-3">
          <Calendar
            // Controlled selection: the form's dob state is the source of
            // truth (clicking the selected day again reports undefined, which
            // we ignore - a DOB must not be cleared by re-clicking).
            selected={selected ?? undefined}
            onSelect={(day) => {
              if (day) {
                onChange(toISODate(day));
                setOpen(false);
              }
            }}
            defaultMonth={selected ?? new Date(today.getFullYear() - 20, today.getMonth(), 1)}
            disabled={(date) => date < startDay || date > lastAllowedDay}
          />
        </PopoverContent>
      </Popover>
      {/* Carries the value into FormData; visible calendar above is the UI. */}
      <input type="hidden" name="dob" value={value} />
    </>
  );
}
