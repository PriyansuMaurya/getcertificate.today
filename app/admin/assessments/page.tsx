import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, Search } from 'lucide-react';
import { requireAdmin } from '../require-admin';
import { getAdminAssessments, statusChip, statusLabel } from './assessments-data';
import AssessmentActions from '@/components/admin/AssessmentActions';

export const metadata: Metadata = {
  title: 'Assessments',
};

const fmtDate = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '\u2014';

/** Builds the /admin/assessments URL for a given search/page/status state. */
function assessmentsUrl(q: string, page: number, status: 'all' | 'failed'): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  if (status === 'failed') params.set('status', 'failed');
  const s = params.toString();
  return s ? `/admin/assessments?${s}` : '/admin/assessments';
}

export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const query = (sp.q ?? '').slice(0, 100);
  const page = Number.parseInt(sp.page ?? '1', 10);
  const status: 'all' | 'failed' = sp.status === 'failed' ? 'failed' : 'all';
  const {
    rows,
    total,
    page: safePage,
    pageCount,
    failedTotal,
  } = await getAdminAssessments(query, Number.isFinite(page) ? page : 1, status);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Assessments</h1>
        <p className="text-sm text-clay sm:text-base">
          Generated question sets, learner attempts, and generation failures.
        </p>
      </div>

      {/* Failed-generation banner: the one thing an operator must not miss. */}
      {failedTotal > 0 && status === 'all' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-600/40 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
            {failedTotal} assessment{failedTotal === 1 ? '' : 's'} generated without a transcript
            (title only) - questions may not reflect the actual course.
          </p>
          <Link
            href={assessmentsUrl(query, 1, 'failed')}
            className="inline-flex h-8 items-center rounded-lg border border-red-600/50 bg-paper px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
          >
            Show only failures
          </Link>
        </div>
      )}

      {/* Search + status tabs - GET form so results are shareable URLs. */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          method="get"
          action="/admin/assessments"
          className="flex w-full max-w-md items-center gap-2"
          role="search"
        >
          <label htmlFor="assessment-search" className="sr-only">
            Search assessments by course, video id, or user
          </label>
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay"
            />
            <input
              id="assessment-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search course, video id, or user…"
              className="h-10 w-full rounded-lg border border-sandline bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <button
            type="submit"
            className="flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
          >
            Search
          </button>
        </form>

        <nav aria-label="Filter by generation status" className="flex items-center gap-2">
          <Link
            href={assessmentsUrl(query, 1, 'all')}
            aria-current={status === 'all' ? 'page' : undefined}
            className={`inline-flex h-9 items-center rounded-lg px-4 text-xs font-bold transition-colors ${
              status === 'all'
                ? 'bg-ink text-cream'
                : 'border border-sandline bg-paper text-clay hover:text-ink'
            }`}
          >
            All
          </Link>
          <Link
            href={assessmentsUrl(query, 1, 'failed')}
            aria-current={status === 'failed' ? 'page' : undefined}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-bold transition-colors ${
              status === 'failed'
                ? 'bg-red-600 text-white'
                : 'border border-sandline bg-paper text-clay hover:text-ink'
            }`}
          >
            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
            Failed ({failedTotal})
          </Link>
        </nav>
      </div>

      <p className="mt-3 text-xs text-clay" aria-live="polite">
        {total.toLocaleString('en-US')} {total === 1 ? 'assessment' : 'assessments'}
        {query ? ` matching “${query}”` : ''}
        {status === 'failed' ? ', generation failures only' : ''}
      </p>

      {rows.length === 0 ? (
        <section
          aria-labelledby="no-assessments-heading"
          className="mt-6 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <h2 id="no-assessments-heading" className="font-fraunces text-xl font-bold text-ink">
            {status === 'failed'
              ? 'No failed generations'
              : query
                ? 'No matching assessments'
                : 'No assessments yet'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-clay">
            {status === 'failed'
              ? 'Every stored assessment was generated from a transcript.'
              : query
                ? 'Try a different course title, video id, or user - or clear the search.'
                : 'Assessments appear here once a learner unlocks one for a course.'}
          </p>
          {(query || status === 'failed') && (
            <Link
              href="/admin/assessments"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-sandline bg-paper px-4 text-xs font-bold text-ink transition-colors hover:bg-ink/5"
            >
              Show all assessments
            </Link>
          )}
        </section>
      ) : (
        <>
          {/* Desktop table / mobile cards: one list, two presentations. */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-sandline bg-paper">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b border-sandline text-xs text-clay">
                    <th scope="col" className="px-4 py-3 font-bold">
                      User
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Course
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      Questions
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      Correct
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      User answers
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      Score
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Result
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Created
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Generation
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr
                      key={a.id}
                      className="last:border-b-none border-b border-sandline hover:bg-linen/60"
                    >
                      <td className="max-w-[180px] px-4 py-3">
                        <Link
                          href={`/admin/users/${a.userId}`}
                          className="block truncate font-semibold text-ink underline-offset-4 hover:underline"
                        >
                          {a.userDisplayName}
                        </Link>
                        <span className="block truncate text-xs text-clay">{a.userEmail}</span>
                      </td>
                      <td className="max-w-[240px] px-4 py-3">
                        <Link
                          href={`/admin/assessments/${a.id}`}
                          className="block truncate font-semibold text-ink underline-offset-4 hover:underline"
                        >
                          {a.courseTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {a.questionCount}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {a.latest ? `${a.latest.correctCount}/${a.questionCount}` : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-xs text-clay">
                        {a.latest ? a.latest.answers.join(', ') : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {a.latest ? `${a.latest.score}%` : '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        {a.latest ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              a.latest.passed ? 'bg-ink text-cream' : 'bg-red-600 text-white'
                            }`}
                          >
                            {a.latest.passed ? 'Pass' : 'Fail'}
                          </span>
                        ) : (
                          <span className="text-xs text-clay">No attempts</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-clay">
                        {fmtDate(a.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${statusChip[a.status]}`}
                        >
                          {statusLabel[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AssessmentActions
                          assessmentId={a.id}
                          courseTitle={a.courseTitle}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked cards below lg - same data, no horizontal scrolling. */}
            <ul className="divide-y divide-sandline lg:hidden">
              {rows.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/assessments/${a.id}`}
                        className="block truncate text-sm font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {a.courseTitle}
                      </Link>
                      <p className="truncate text-xs text-clay">
                        {a.userDisplayName} {'\u00b7'} {fmtDate(a.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${statusChip[a.status]}`}
                    >
                      {statusLabel[a.status]}
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Questions</dt>
                      <dd className="text-sm font-bold text-ink">{a.questionCount}</dd>
                    </div>
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Score</dt>
                      <dd className="text-sm font-bold text-ink">
                        {a.latest ? `${a.latest.score}%` : '\u2014'}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Result</dt>
                      <dd className="text-sm font-bold text-ink">
                        {a.latest ? (a.latest.passed ? 'Pass' : 'Fail') : '\u2014'}
                      </dd>
                    </div>
                  </dl>
                  <AssessmentActions assessmentId={a.id} courseTitle={a.courseTitle} />
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <nav
              aria-label="Assessments pagination"
              className="mt-4 flex items-center justify-between gap-3"
            >
              {safePage > 1 ? (
                <Link
                  href={assessmentsUrl(query, safePage - 1, status)}
                  className="inline-flex h-9 items-center rounded-lg border border-sandline bg-paper px-4 text-xs font-bold text-ink transition-colors hover:bg-ink/5"
                >
                  ← Previous
                </Link>
              ) : (
                <span aria-hidden="true" className="h-9" />
              )}
              <p className="text-xs text-clay">
                Page {safePage} of {pageCount}
              </p>
              {safePage < pageCount ? (
                <Link
                  href={assessmentsUrl(query, safePage + 1, status)}
                  className="inline-flex h-9 items-center rounded-lg border border-sandline bg-paper px-4 text-xs font-bold text-ink transition-colors hover:bg-ink/5"
                >
                  Next →
                </Link>
              ) : (
                <span aria-hidden="true" className="h-9" />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
