import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { credentialsTable, learningItemsTable, usersTable } from '@/utils/db/schema';
import AddLearningForm from '@/components/learning/AddLearningForm';
import { ArrowRight, BadgeCheck, BookOpen, Clock3, Play } from 'lucide-react';

export default async function Dashboard() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect('/login');
  }

  const userId = data.user.id;

  const [items, credentials, profileRows] = await Promise.all([
    db
      .select({
        id: learningItemsTable.id,
        title: learningItemsTable.title,
        progress_percent: learningItemsTable.progress_percent,
        duration_seconds: learningItemsTable.duration_seconds,
        position_seconds: learningItemsTable.position_seconds,
        watched_seconds: learningItemsTable.watched_seconds,
        updated_at: learningItemsTable.updated_at,
      })
      .from(learningItemsTable)
      .where(eq(learningItemsTable.user_id, userId))
      .orderBy(desc(learningItemsTable.updated_at)),
    db
      .select({
        id: credentialsTable.id,
        item_title: credentialsTable.item_title,
        score: credentialsTable.score,
        passed_at: credentialsTable.passed_at,
        status: credentialsTable.status,
      })
      .from(credentialsTable)
      .where(eq(credentialsTable.user_id, userId))
      .orderBy(desc(credentialsTable.passed_at)),
    db
      .select({
        first_name: usersTable.first_name,
        last_name: usersTable.last_name,
        username: usersTable.username,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId)),
  ]);

  const profile = profileRows[0];
  const displayName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : (profile?.username ?? data.user.email);

  const inProgress = items.filter((i) => i.progress_percent > 0 && i.progress_percent < 100).length;
  // Sum the unique watched seconds the server recorded (not a percent estimate).
  const totalSeconds = items.reduce((sum, i) => sum + Math.max(0, i.watched_seconds), 0);
  const hoursLearned = Math.round((totalSeconds / 3600) * 10) / 10;

  const stats = [
    {
      label: 'Courses In Progress',
      value: String(inProgress),
      icon: BookOpen,
      help: inProgress > 0 ? 'Keep going - 80% unlocks the assessment' : 'Add a video to begin',
    },
    {
      label: 'Certificates Earned',
      value: String(credentials.length),
      icon: BadgeCheck,
      help: 'Verifiable credentials with unique IDs',
    },
    {
      label: 'Hours Learned',
      value: hoursLearned > 0 ? `${hoursLearned}h` : '0h',
      icon: Clock3,
      help: 'From your tracked watch time',
    },
  ];

  const nextUp = items.find((i) => i.progress_percent < 100);

  return (
    <main id="main-content" className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">My Learning</p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-clay sm:text-base">
            {items.length === 0
              ? 'Paste a YouTube link below to start your first learning path.'
              : `${items.length} course${items.length === 1 ? '' : 's'} in your library.`}
          </p>
        </div>

        <section
          aria-labelledby="new-path-heading"
          className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <div className="flex items-start gap-3">
            {/* Decorative icon tile dropped on phones - it crowds the heading
                once the section falls back to p-5 padding. */}
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink sm:flex">
              <Play aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="new-path-heading" className="font-fraunces text-2xl font-bold text-ink">
                Start a new learning path
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-clay">
                Paste any YouTube video link - watch it in the app, and the AI assessment unlocks at
                80% completion.
              </p>
              <div className="mt-5">
                <AddLearningForm />
              </div>
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

        {/* Two columns from tablet portrait up; the asymmetric 60/40 split only
            returns at xl, where the 280px sidebar leaves enough width for it.
            Titles clamp to two lines from sm up (single-line below sm). */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">
          <section
            aria-labelledby="recent-activity-heading"
            className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-activity-heading" className="font-fraunces text-xl font-bold text-ink">
                Recent Activity
              </h2>
              <Link
                href="/dashboard/learning"
                className="text-sm font-semibold text-ink underline underline-offset-4 hover:text-clay"
              >
                View all
              </Link>
            </div>

            {items.length === 0 && credentials.length === 0 ? (
              <p className="mt-6 text-sm text-clay">
                No activity yet - add your first video above and it will show up here.
              </p>
            ) : (
              <ul className="mt-5 flex flex-col gap-3">
                {credentials.slice(0, 2).map((cred) => (
                  <li key={cred.id}>
                    <Link
                      href={`/certificates/${cred.id}`}
                      className="flex items-center gap-3 rounded-xl bg-cream p-4 transition-colors hover:bg-linen"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-cream">
                        <BadgeCheck aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          title={`Certificate earned - ${cred.item_title}`}
                          className="block truncate text-sm font-semibold text-ink sm:line-clamp-2 sm:whitespace-normal"
                        >
                          Certificate earned - {cred.item_title}
                        </span>
                        <span className="block text-xs text-clay">
                          Score {cred.score}% ·{' '}
                          {cred.passed_at.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-clay" />
                    </Link>
                  </li>
                ))}
                {items.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/learn/${item.id}`}
                      className="flex items-center gap-3 rounded-xl bg-cream p-4 transition-colors hover:bg-linen"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
                        <BookOpen aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          title={item.title ?? 'YouTube video'}
                          className="block truncate text-sm font-semibold text-ink sm:line-clamp-2 sm:whitespace-normal"
                        >
                          {item.title ?? 'YouTube video'}
                        </span>
                        <span className="block text-xs text-clay">
                          {item.progress_percent >= 100
                            ? 'Completed'
                            : `${item.progress_percent}% watched`}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-clay" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="next-up-heading"
            className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
          >
            <h2 id="next-up-heading" className="font-fraunces text-xl font-bold text-ink">
              Next Up
            </h2>
            {nextUp ? (
              <div className="mt-5">
                <div className="flex items-start gap-3 rounded-xl bg-cream p-4">
                  <Play aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
                  <div className="min-w-0">
                    <p
                      title={nextUp.title ?? 'YouTube video'}
                      className="truncate text-sm font-semibold text-ink sm:line-clamp-2 sm:whitespace-normal"
                    >
                      {nextUp.title ?? 'YouTube video'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-clay">
                      {nextUp.progress_percent}% watched - pick up where you left off.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/learn/${nextUp.id}`}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                >
                  Continue learning
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-cream p-4">
                <BookOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
                <div>
                  <p className="text-sm font-semibold text-ink">Your queue is empty</p>
                  <p className="mt-1 text-xs leading-relaxed text-clay">
                    Add a course above - it will appear here as your next thing to learn.
                  </p>
                </div>
              </div>
            )}

            <Link
              href="/subscribe"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-ink underline underline-offset-4"
            >
              Explore plans
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
