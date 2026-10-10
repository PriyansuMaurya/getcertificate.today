import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Percent,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { requireAdmin } from './require-admin';
import { ACTIVE_WINDOW_DAYS, getAdminOverview } from './overview-data';
import Avatar from '@/components/Avatar';

export const metadata: Metadata = {
  title: 'Overview',
};

const fmtDate = (d: Date | null | undefined, withYear = false) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(withYear ? { year: 'numeric' } : {}),
      })
    : '\u2014';

export default async function AdminOverviewPage() {
  await requireAdmin();
  const { metrics, recentUsers, recentCredentials, failures } = await getAdminOverview();

  const passRate =
    metrics.attemptsTotal > 0
      ? `${Math.round((metrics.attemptsPassed / metrics.attemptsTotal) * 100)}%`
      : '\u2014';

  const metricCards: {
    label: string;
    value: string;
    icon: LucideIcon;
    help: string;
  }[] = [
    {
      label: 'Total Users',
      value: metrics.totalUsers.toLocaleString('en-US'),
      icon: Users,
      help: 'Registered accounts, all time',
    },
    {
      label: 'Active Users',
      value: metrics.activeUsers.toLocaleString('en-US'),
      icon: Activity,
      help: `Watched or added a course in the last ${ACTIVE_WINDOW_DAYS} days`,
    },
    {
      label: 'Videos/Playlists Added',
      value: metrics.videosAdded.toLocaleString('en-US'),
      icon: Video,
      help: 'Learning items across all libraries',
    },
    {
      label: 'Assessments Taken',
      value: metrics.assessmentsTaken.toLocaleString('en-US'),
      icon: ClipboardCheck,
      help: 'Attempt submissions, all time',
    },
    {
      label: 'Pass Rate',
      value: passRate,
      icon: Percent,
      help:
        metrics.attemptsTotal > 0
          ? `${metrics.attemptsPassed} of ${metrics.attemptsTotal} attempts passed`
          : 'No attempts yet',
    },
    {
      label: 'Credentials Issued',
      value: metrics.credentialsIssued.toLocaleString('en-US'),
      icon: BadgeCheck,
      help:
        metrics.credentialsRevoked > 0
          ? `${metrics.credentialsRevoked} revoked \u00b7 ${metrics.credentialsIssued - metrics.credentialsRevoked} active`
          : 'Tamper-evident certificates minted',
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Overview</h1>
        <p className="text-sm text-clay sm:text-base">
          Platform totals, the latest signups and certificates, and failures that need a look.
        </p>
      </div>

      <section
        aria-label="Platform metrics"
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {metricCards.map(({ label, value, icon: Icon, help }) => (
          <div key={label} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-clay">{label}</h2>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 font-fraunces text-4xl font-black text-ink">{value}</p>
            <p className="mt-1 text-xs text-clay">{help}</p>
          </div>
        ))}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Recent users */}
        <section
          aria-labelledby="recent-users-heading"
          className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
        >
          <h2 id="recent-users-heading" className="font-fraunces text-xl font-bold text-ink">
            Recent Users
          </h2>
          {recentUsers.length === 0 ? (
            <p className="mt-5 text-sm text-clay">
              No users yet - new signups appear here right away.
            </p>
          ) : (
            <ul className="mt-5 flex flex-col gap-3">
              {recentUsers.map((u) => (
                <li key={u.id} className="rounded-xl bg-cream p-4">
                  <div className="flex items-center gap-3">
                    <Avatar seed={u.id} className="h-9 w-9 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{u.displayName}</p>
                      <p className="truncate text-xs text-clay">
                        {u.email}
                        {u.joinedAt ? ` \u00b7 joined ${fmtDate(u.joinedAt, true)}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-sandline bg-paper px-2.5 py-1 text-xs font-bold text-clay">
                      {u.isAdmin ? 'Admin' : u.planLabel}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent credentials */}
        <section
          aria-labelledby="recent-credentials-heading"
          className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
        >
          <h2 id="recent-credentials-heading" className="font-fraunces text-xl font-bold text-ink">
            Recent Credentials
          </h2>
          {recentCredentials.length === 0 ? (
            <p className="mt-5 text-sm text-clay">
              No credentials issued yet - certificates appear here after a learner passes.
            </p>
          ) : (
            <ul className="mt-5 flex flex-col gap-3">
              {recentCredentials.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/certificates/${c.id}`}
                    className="flex items-center gap-3 rounded-xl bg-cream p-4 transition-colors hover:bg-linen"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-cream">
                      <BadgeCheck aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {c.itemTitle}
                      </span>
                      <span className="block truncate text-xs text-clay">
                        {c.holderName} {'\u00b7'} score {c.score} {'\u00b7'}{' '}
                        {fmtDate(c.passedAt, true)}
                        {c.status === 'revoked' ? (
                          <span className="font-bold text-red-600">{'\u00b7'} revoked</span>
                        ) : null}
                      </span>
                    </span>
                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-clay" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Failures: failed attempts + transcript-less assessments */}
        <section
          aria-labelledby="recent-failures-heading"
          className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6 md:col-span-2 xl:col-span-1"
        >
          <h2 id="recent-failures-heading" className="font-fraunces text-xl font-bold text-ink">
            Recent Failures
          </h2>
          <p className="mt-1 text-xs text-clay">Failed attempts and missing transcripts.</p>
          {failures.length === 0 ? (
            <p className="mt-5 text-sm text-clay">
              No recent failures - failed attempts and missing transcripts show up here.
            </p>
          ) : (
            <ul className="mt-5 flex flex-col gap-3">
              {failures.map((f) => (
                <li key={f.key} className="rounded-xl bg-cream p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-sandline bg-paper px-2 py-0.5 text-[11px] font-bold text-clay">
                        {f.kind === 'attempt' ? (
                          <XCircle aria-hidden="true" className="h-3 w-3 text-red-600" />
                        ) : (
                          <AlertTriangle aria-hidden="true" className="h-3 w-3" />
                        )}
                        {f.kind === 'attempt' ? 'Failed attempt' : 'No transcript'}
                      </span>
                      <p className="mt-2 truncate text-sm font-semibold text-ink">{f.title}</p>
                      <p className="mt-0.5 truncate text-xs text-clay">{f.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-clay">{fmtDate(f.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
