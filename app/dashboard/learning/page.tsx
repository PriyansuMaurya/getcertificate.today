import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { learningItemsTable } from '@/utils/db/schema';
import { eq, desc } from 'drizzle-orm';
import AddLearningForm from '@/components/learning/AddLearningForm';
import DeleteLearningItemButton from '@/components/learning/DeleteLearningItemButton';
import { ArrowRight, BookOpen, Clock3, ExternalLink } from 'lucide-react';

export const metadata = {
  title: 'My Learning | getcertificate.today',
  description: 'Your YouTube courses and progress.',
};

function statusLabel(item: { progress_percent: number; position_seconds: number }): {
  text: string;
  tone: 'done' | 'active' | 'new';
} {
  if (item.progress_percent >= 100) return { text: 'Completed', tone: 'done' };
  if (item.progress_percent > 0 || item.position_seconds > 0) {
    return { text: `${item.progress_percent}% watched`, tone: 'active' };
  }
  return { text: 'Not started', tone: 'new' };
}

export default async function MyLearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const items = await db
    .select()
    .from(learningItemsTable)
    .where(eq(learningItemsTable.user_id, user.id))
    .orderBy(desc(learningItemsTable.updated_at));

  return (
    <main id="main-content" className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">My Learning</p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">
            Your learning courses
          </h1>
          <p className="text-sm text-clay sm:text-base">
            Add a YouTube video, watch it here, and unlock an AI assessment at 80%.
          </p>
        </div>

        <section
          aria-labelledby="add-video-heading"
          className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
        >
          <h2 id="add-video-heading" className="font-fraunces text-xl font-bold text-ink">
            Add a new course
          </h2>
          <div className="mt-4">
            <AddLearningForm />
          </div>
        </section>

        <section aria-label="Course list" className="mt-8">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sandline bg-paper px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-linen text-ink">
                <BookOpen aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="font-fraunces text-xl font-bold text-ink">No courses yet</h2>
              <p className="max-w-md text-sm text-clay">
                Paste your first YouTube link above — it will show up here with your progress.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((item) => {
                const status = statusLabel(item);
                const canAssess = item.progress_percent >= 80;
                return (
                  <li
                    key={item.id}
                    className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-fraunces text-lg font-bold text-ink">
                            {item.title ?? 'YouTube video'}
                          </h3>
                          <span
                            className={
                              status.tone === 'done'
                                ? 'rounded-full border border-sandline bg-cream px-2.5 py-0.5 text-[11px] font-bold text-ink'
                                : status.tone === 'active'
                                  ? 'rounded-full border border-sandline bg-linen px-2.5 py-0.5 text-[11px] font-bold text-ink'
                                  : 'rounded-full border border-sandline bg-cream px-2.5 py-0.5 text-[11px] font-bold text-clay'
                            }
                          >
                            {status.text}
                          </span>
                          {canAssess && (
                            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-cream">
                              Assessment unlocked
                            </span>
                          )}
                        </div>
                        {item.author && <p className="mt-1 text-sm text-clay">{item.author}</p>}
                        <div
                          role="progressbar"
                          aria-valuenow={item.progress_percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Watch progress"
                          className="mt-3 h-2 w-full max-w-[360px] overflow-hidden rounded-full bg-linen"
                        >
                          <div
                            className="h-full rounded-full bg-ink transition-[width]"
                            style={{ width: `${item.progress_percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/learn/${item.id}`}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
                        >
                          {item.progress_percent > 0 && item.progress_percent < 100
                            ? 'Continue'
                            : 'Open'}
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-sandline px-4 text-sm font-semibold text-clay transition-colors hover:border-ink hover:text-ink"
                        >
                          Source
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                        <DeleteLearningItemButton
                          itemId={item.id}
                          title={item.title ?? 'this course'}
                        />
                      </div>
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-xs text-clay">
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
                      {item.duration_seconds > 0
                        ? `${Math.round(item.duration_seconds / 60)} min video`
                        : 'Duration loads on open'}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
