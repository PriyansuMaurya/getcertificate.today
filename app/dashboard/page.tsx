import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import { ArrowRight, BadgeCheck, BookOpen, Clock3, LockKeyhole, Play } from 'lucide-react';

export default async function Dashboard() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect('/login');
  }

  const profileRows = await db
    .select({
      username: usersTable.username,
      first_name: usersTable.first_name,
      last_name: usersTable.last_name,
      plan: usersTable.plan,
    })
    .from(usersTable)
    .where(eq(usersTable.id, data.user.id));

  const profile = profileRows[0];
  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : (profile?.username ?? data.user.email);
  const isSubscribed = Boolean(profile && profile.plan && profile.plan !== 'none');

  const stats = [
    {
      label: 'Courses In Progress',
      value: 'N/A',
      icon: BookOpen,
      help: 'Learning paths are not available yet',
    },
    {
      label: 'Certificates Earned',
      value: 'N/A',
      icon: BadgeCheck,
      help: 'Credentials are not available yet',
    },
    {
      label: 'Hours Learned',
      value: 'N/A',
      icon: Clock3,
      help: 'Learning time is not tracked yet',
    },
  ];

  return (
    <main className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">MyLearning</p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-clay sm:text-base">
            Your learner workspace is ready. Learning paths are coming soon.
          </p>
        </div>

        <section
          aria-labelledby="new-path-heading"
          className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
              <Play aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="new-path-heading" className="font-fraunces text-2xl font-bold text-ink">
                Start a new learning path
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-clay">
                Learning paths are not available yet. Your account and dashboard are ready for when
                they launch.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="sr-only" htmlFor="youtube-url">
                  YouTube course link
                </label>
                <input
                  id="youtube-url"
                  type="url"
                  placeholder="YouTube course link"
                  disabled
                  aria-describedby="learning-path-status"
                  className="h-12 min-w-0 flex-1 rounded-lg border border-sandline bg-cream px-4 text-sm text-ink placeholder:text-clay/70 disabled:cursor-not-allowed disabled:opacity-70"
                />
                <button
                  type="button"
                  disabled
                  className="flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Start Learning</span>
                  <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <p id="learning-path-status" className="mt-2 text-xs text-clay">
                Course and credential features are coming soon.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label="Learning summary"
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {stats.map(({ label, value, icon: Icon, help }) => (
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

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section
            aria-labelledby="recent-activity-heading"
            className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
          >
            <h2 id="recent-activity-heading" className="font-fraunces text-xl font-bold text-ink">
              Recent Activity
            </h2>
            <p className="mt-6 text-sm text-clay">Learning activity is not available yet.</p>
          </section>
          <section
            aria-labelledby="next-up-heading"
            className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
          >
            <h2 id="next-up-heading" className="font-fraunces text-xl font-bold text-ink">
              Next Up
            </h2>
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-cream p-4">
              <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
              <div>
                <p className="text-sm font-semibold text-ink">Learning paths are coming soon</p>
                <p className="mt-1 text-xs leading-relaxed text-clay">
                  Your courses, progress, and credentials will appear here.
                </p>
              </div>
            </div>
            {!isSubscribed && (
              <Link
                href="/subscribe"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-ink underline underline-offset-4"
              >
                Explore plans
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
