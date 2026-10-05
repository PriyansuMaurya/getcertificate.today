import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireAdmin } from '../require-admin';
import { getAdminUsers } from './users-data';
import UserActions from '@/components/admin/UserActions';

export const metadata: Metadata = {
  title: 'Users',
};

const fmtDate = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '\u2014';

/** Builds the /admin/users URL for a given search/page state. */
function usersUrl(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const s = params.toString();
  return s ? `/admin/users?${s}` : '/admin/users';
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const query = (sp.q ?? '').slice(0, 100);
  const page = Number.parseInt(sp.page ?? '1', 10);
  const {
    rows,
    total,
    page: safePage,
    pageCount,
  } = await getAdminUsers(query, Number.isFinite(page) ? page : 1);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Users</h1>
        <p className="text-sm text-clay sm:text-base">
          Search accounts, review activity, and moderate access.
        </p>
      </div>

      {/* Search - GET form so results are shareable/bookmarkable URLs. */}
      <form
        method="get"
        action="/admin/users"
        className="mt-6 flex max-w-md items-center gap-2"
        role="search"
      >
        <label htmlFor="user-search" className="sr-only">
          Search users by name, username, or email
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay"
          />
          <input
            id="user-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name, username, or email…"
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

      <p className="mt-3 text-xs text-clay" aria-live="polite">
        {total.toLocaleString('en-US')} {total === 1 ? 'account' : 'accounts'}
        {query ? ` matching “${query}”` : ''}
      </p>

      {rows.length === 0 ? (
        <section
          aria-labelledby="no-users-heading"
          className="mt-6 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <h2 id="no-users-heading" className="font-fraunces text-xl font-bold text-ink">
            {query ? 'No matching accounts' : 'No users yet'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-clay">
            {query
              ? 'Try a different name, username, or email - or clear the search to see everyone.'
              : 'New signups appear here as soon as they create an account.'}
          </p>
          {query && (
            <Link
              href="/admin/users"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-sandline bg-paper px-4 text-xs font-bold text-ink transition-colors hover:bg-ink/5"
            >
              Clear search
            </Link>
          )}
        </section>
      ) : (
        <>
          {/* Desktop table / mobile cards: one list, two presentations. */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-sandline bg-paper">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-sandline text-xs text-clay">
                    <th scope="col" className="px-4 py-3 font-bold">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Signup date
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      Videos
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      Assessments
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      Credentials
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr
                      key={u.id}
                      className="last:border-b-none border-b border-sandline hover:bg-linen/60"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="font-semibold text-ink underline-offset-4 hover:underline"
                        >
                          {u.displayName}
                        </Link>
                        {u.isAdmin && (
                          <span className="ml-2 rounded-full border border-sandline bg-linen px-2 py-0.5 text-[11px] font-bold text-clay">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-clay">{u.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-clay">
                        {fmtDate(u.joinedAt)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {u.videosAdded}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {u.assessmentsTaken}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {u.credentialsEarned}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            u.status === 'suspended'
                              ? 'bg-red-600 text-white'
                              : 'bg-linen text-clay'
                          }`}
                        >
                          {u.status === 'suspended' ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <UserActions
                          userId={u.id}
                          email={u.email}
                          isSuspended={u.status === 'suspended'}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stacked cards below md - same data, no horizontal scrolling. */}
            <ul className="divide-y divide-sandline md:hidden">
              {rows.map((u) => (
                <li key={u.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="block truncate text-sm font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        {u.displayName}
                      </Link>
                      <p className="truncate text-xs text-clay">{u.email}</p>
                      <p className="mt-0.5 text-xs text-clay">Joined {fmtDate(u.joinedAt)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        u.status === 'suspended' ? 'bg-red-600 text-white' : 'bg-linen text-clay'
                      }`}
                    >
                      {u.status === 'suspended' ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Videos</dt>
                      <dd className="text-sm font-bold text-ink">{u.videosAdded}</dd>
                    </div>
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Assessments</dt>
                      <dd className="text-sm font-bold text-ink">{u.assessmentsTaken}</dd>
                    </div>
                    <div className="rounded-lg bg-linen py-2">
                      <dt className="text-[10px] font-bold uppercase text-clay">Credentials</dt>
                      <dd className="text-sm font-bold text-ink">{u.credentialsEarned}</dd>
                    </div>
                  </dl>
                  <UserActions
                    userId={u.id}
                    email={u.email}
                    isSuspended={u.status === 'suspended'}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <nav
              aria-label="Users pagination"
              className="mt-4 flex items-center justify-between gap-3"
            >
              {safePage > 1 ? (
                <Link
                  href={usersUrl(query, safePage - 1)}
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
                  href={usersUrl(query, safePage + 1)}
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
