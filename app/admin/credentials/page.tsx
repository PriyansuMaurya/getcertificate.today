import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireAdmin } from '../require-admin';
import {
  getAdminCredentials,
  parseCredentialSort,
  parseCredentialStatus,
  type CredentialStatusFilter,
  type CredentialSort,
} from './credentials-data';
import CredentialActions from '@/components/admin/CredentialActions';
import AdminNotice from '@/components/admin/AdminNotice';

export const metadata: Metadata = {
  title: 'Credentials',
};

const fmtDate = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '\u2014';

/** Builds the /admin/credentials URL for a search/page/status/sort state. */
function credentialsUrl(
  q: string,
  page: number,
  status: CredentialStatusFilter,
  sort: CredentialSort
): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status !== 'all') params.set('status', status);
  if (sort !== 'newest') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  const s = params.toString();
  return s ? `/admin/credentials?${s}` : '/admin/credentials';
}

export default async function AdminCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    sort?: string;
    deleted?: string;
  }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const query = (sp.q ?? '').slice(0, 100);
  const status = parseCredentialStatus(sp.status);
  const sort = parseCredentialSort(sp.sort);
  const page = Number.parseInt(sp.page ?? '1', 10);
  const {
    rows,
    total,
    page: safePage,
    pageCount,
  } = await getAdminCredentials(query, Number.isFinite(page) ? page : 1, status, sort);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Credentials</h1>
        <p className="text-sm text-clay sm:text-base">
          Search issued credentials, check their status, and open the public record.
        </p>
      </div>

      {sp.deleted === '1' && <AdminNotice message="Credential deleted." />}

      {/* Search + status + sort - GET form so results are shareable URLs. */}
      <form
        method="get"
        action="/admin/credentials"
        className="mt-6 flex flex-wrap items-center gap-2"
        role="search"
      >
        <label htmlFor="credential-search" className="sr-only">
          Search credentials by id, holder, course, or user
        </label>
        <div className="relative min-w-[200px] flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay"
          />
          <input
            id="credential-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search credential id, holder, course, or user…"
            className="h-10 w-full rounded-lg border border-sandline bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>
        <label htmlFor="credential-status" className="sr-only">
          Filter by status
        </label>
        <select
          id="credential-status"
          name="status"
          defaultValue={status}
          className="h-10 rounded-lg border border-sandline bg-paper px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        >
          <option value="all">Any status</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
        <label htmlFor="credential-sort" className="sr-only">
          Sort credentials
        </label>
        <select
          id="credential-sort"
          name="sort"
          defaultValue={sort}
          className="h-10 rounded-lg border border-sandline bg-paper px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button
          type="submit"
          className="flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-cream transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          Apply
        </button>
      </form>

      <p className="mt-3 text-xs text-clay" aria-live="polite">
        {total.toLocaleString('en-US')} {total === 1 ? 'credential' : 'credentials'}
        {query ? ` matching “${query}”` : ''}
        {status !== 'all' ? `, ${status} only` : ''}
      </p>

      {rows.length === 0 ? (
        <section
          aria-labelledby="no-credentials-heading"
          className="mt-6 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <h2 id="no-credentials-heading" className="font-fraunces text-xl font-bold text-ink">
            {query || status !== 'all' ? 'No matching credentials' : 'No credentials yet'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-clay">
            {query || status !== 'all'
              ? 'Try a different id, holder, course, or user - or clear the search and filters.'
              : 'Credentials appear here as soon as a learner passes an assessment.'}
          </p>
          {(query || status !== 'all') && (
            <Link
              href="/admin/credentials"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-sandline bg-paper px-4 text-xs font-bold text-ink transition-colors hover:bg-ink/5"
            >
              Clear search and filters
            </Link>
          )}
        </section>
      ) : (
        <>
          {/* Desktop table / mobile cards: one list, two presentations. */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-sandline bg-paper">
            {/* `relative` contains the absolutely-positioned sr-only "Actions" header
                span, which would otherwise escape this scroll container and widen
                the page past the viewport. */}
            <div className="relative hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-sandline text-xs text-clay [&>th]:whitespace-nowrap">
                    <th scope="col" className="px-3 py-3 font-bold">
                      Credential
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      Holder
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      Course
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">
                      Score
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold">
                      Issued
                    </th>
                    <th scope="col" className="px-3 py-3 text-right font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-sandline last:border-b-0 hover:bg-linen/60"
                    >
                      <td className="px-3 py-3">
                        <Link
                          href={`/certificates/${c.id}`}
                          title={c.id}
                          className="block max-w-[220px] truncate font-mono text-xs font-semibold text-ink underline-offset-4 hover:underline"
                        >
                          {c.id}
                        </Link>
                      </td>
                      <td className="max-w-[200px] px-3 py-3">
                        <Link
                          href={`/admin/users/${c.userId}`}
                          className="block truncate font-semibold text-ink underline-offset-4 hover:underline"
                        >
                          {c.holderName}
                        </Link>
                        <span className="block truncate text-xs text-clay">
                          {c.userDisplayName !== c.holderName
                            ? `${c.userDisplayName} \u00b7 ${c.userEmail}`
                            : c.userEmail}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-clay">{c.itemTitle}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink">
                        {c.score}%
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            c.status === 'revoked' ? 'bg-red-600 text-white' : 'bg-linen text-clay'
                          }`}
                        >
                          {c.status === 'revoked' ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-clay">
                        {fmtDate(c.issuedAt)}
                      </td>
                      <td className="px-3 py-3">
                        <CredentialActions
                          credentialId={c.id}
                          holderName={c.holderName}
                          status={c.status}
                          returnTo={credentialsUrl(query, safePage, status, sort)}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked cards below md - same data, no horizontal scrolling. */}
            <ul className="divide-y divide-sandline xl:hidden">
              {rows.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${c.userId}`}
                        className="block truncate text-sm font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {c.holderName}
                      </Link>
                      <p className="truncate text-xs text-clay">{c.itemTitle}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        c.status === 'revoked' ? 'bg-red-600 text-white' : 'bg-linen text-clay'
                      }`}
                    >
                      {c.status === 'revoked' ? 'Revoked' : 'Active'}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Score</dt>
                      <dd className="text-sm font-bold text-ink">{c.score}%</dd>
                    </div>
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Issued</dt>
                      <dd className="text-sm font-bold text-ink">{fmtDate(c.issuedAt)}</dd>
                    </div>
                  </dl>
                  <Link
                    href={`/certificates/${c.id}`}
                    title={c.id}
                    className="block max-w-[220px] truncate font-mono text-xs text-clay underline-offset-4 hover:underline"
                  >
                    {c.id}
                  </Link>
                  <CredentialActions
                    credentialId={c.id}
                    holderName={c.holderName}
                    status={c.status}
                    returnTo={credentialsUrl(query, safePage, status, sort)}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <nav
              aria-label="Credentials pagination"
              className="mt-4 flex items-center justify-between gap-3"
            >
              {safePage > 1 ? (
                <Link
                  href={credentialsUrl(query, safePage - 1, status, sort)}
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
                  href={credentialsUrl(query, safePage + 1, status, sort)}
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
