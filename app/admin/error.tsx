'use client';

import { AlertTriangle } from 'lucide-react';

// Catches data-loading failures from admin pages (queries, requireAdmin DB
// errors in the page). Layout-level auth redirects are unaffected: Next
// handles redirect()/notFound() before this boundary. The internal console
// shows the message + digest so an operator can act on it.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[840px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">
          Overview unavailable
        </h1>
        <p className="text-sm text-clay sm:text-base">
          The dashboard data could not be loaded. This is usually a temporary database or connection
          problem.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-red-600">
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-fraunces text-xl font-bold text-ink">Something went wrong</h2>
            <p className="mt-2 break-words text-sm leading-relaxed text-clay">
              {error.message || 'Unexpected error while loading admin data.'}
            </p>
            {error.digest ? (
              <p className="mt-1 text-xs text-clay">Reference: {error.digest}</p>
            ) : null}
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
