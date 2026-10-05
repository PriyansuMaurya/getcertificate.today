import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ClipboardCheck, Video } from 'lucide-react';
import { requireAdmin } from '../../require-admin';
import { getAdminUserDetail } from '../users-data';
import UserActions from '@/components/admin/UserActions';

export const metadata: Metadata = {
  title: 'User details',
};

const fmtDate = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '\u2014';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const user = await getAdminUserDetail(id);
  if (!user) notFound();

  const passRate =
    user.stats.assessmentsTaken > 0
      ? `${Math.round((user.stats.attemptsPassed / user.stats.assessmentsTaken) * 100)}%`
      : '\u2014';

  const stats = [
    { label: 'Videos Added', value: user.stats.videosAdded, icon: Video },
    { label: 'Assessments Taken', value: user.stats.assessmentsTaken, icon: ClipboardCheck },
    { label: 'Credentials Earned', value: user.stats.credentialsEarned, icon: BadgeCheck },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-clay transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All users
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-linen font-fraunces text-xl font-bold text-ink">
            {user.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-fraunces text-2xl font-black text-ink sm:text-3xl">
                {user.displayName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  user.status === 'suspended' ? 'bg-red-600 text-white' : 'bg-linen text-clay'
                }`}
              >
                {user.status === 'suspended' ? 'Suspended' : 'Active'}
              </span>
              {user.isAdmin && (
                <span className="rounded-full border border-sandline bg-paper px-2.5 py-1 text-[11px] font-bold text-clay">
                  Admin
                </span>
              )}
            </div>
            <p className="mt-1 break-all text-sm text-clay">{user.email}</p>
            <p className="mt-0.5 text-xs text-clay">
              {user.username ? `@${user.username} \u00b7 ` : ''}
              {`${user.planLabel} plan`} {'\u00b7'} {`joined ${fmtDate(user.joinedAt)}`}
            </p>
          </div>
        </div>

        <UserActions
          userId={user.id}
          email={user.email}
          isSuspended={user.status === 'suspended'}
          returnTo="/admin/users"
        />
      </div>

      {/* Core stats */}
      <section
        aria-label="Account activity totals"
        className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-sandline bg-paper p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-clay">{label}</h2>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 font-fraunces text-3xl font-black text-ink">
              {value.toLocaleString('en-US')}
            </p>
          </div>
        ))}
        <div className="rounded-2xl border border-sandline bg-paper p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-clay">Pass Rate</h2>
          </div>
          <p className="mt-3 font-fraunces text-3xl font-black text-ink">{passRate}</p>
          <p className="mt-1 text-xs text-clay">
            {user.stats.assessmentsTaken > 0
              ? `${user.stats.attemptsPassed} of ${user.stats.assessmentsTaken} passed`
              : 'No attempts yet'}
          </p>
        </div>
      </section>

      {/* Recent activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          aria-labelledby="detail-items-heading"
          className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
        >
          <h2 id="detail-items-heading" className="font-fraunces text-xl font-bold text-ink">
            Recent Courses
          </h2>
          {user.recentItems.length === 0 ? (
            <p className="mt-4 text-sm text-clay">No courses added yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {user.recentItems.map((item) => (
                <li key={item.id} className="rounded-xl bg-cream p-4">
                  <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs text-clay">
                    {item.kind === 'playlist' ? 'Playlist' : 'Video'} {'\u00b7'}{' '}
                    {`added ${fmtDate(item.addedAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="detail-attempts-heading"
          className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
        >
          <h2 id="detail-attempts-heading" className="font-fraunces text-xl font-bold text-ink">
            Recent Attempts
          </h2>
          {user.recentAttempts.length === 0 ? (
            <p className="mt-4 text-sm text-clay">No assessment attempts yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {user.recentAttempts.map((a) => (
                <li key={a.id} className="rounded-xl bg-cream p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{a.itemTitle}</p>
                      <p className="mt-0.5 text-xs text-clay">Score {a.score}%</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        a.passed ? 'bg-ink text-cream' : 'bg-red-600 text-white'
                      }`}
                    >
                      {a.passed ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="detail-credentials-heading"
          className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
        >
          <h2 id="detail-credentials-heading" className="font-fraunces text-xl font-bold text-ink">
            Recent Credentials
          </h2>
          {user.recentCredentials.length === 0 ? (
            <p className="mt-4 text-sm text-clay">No credentials earned yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {user.recentCredentials.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/certificates/${c.id}`}
                    className="flex items-center gap-3 rounded-xl bg-cream p-4 transition-colors hover:bg-linen"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {c.itemTitle}
                      </span>
                      <span className="block text-xs text-clay">
                        {`Score ${c.score} \u00b7 ${fmtDate(c.at)}`}
                        {c.status === 'revoked' ? (
                          <span className="font-bold text-red-600">{'\u00b7 revoked'}</span>
                        ) : null}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
