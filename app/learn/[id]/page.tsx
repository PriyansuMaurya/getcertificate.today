import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { assessmentsTable, attemptsTable, learningItemsTable } from '@/utils/db/schema';
import { UNLOCK_PERCENT } from '@/utils/credentials';
import { getSettings } from '@/utils/settings';
import { assessmentQuestionCountForDuration } from '@/utils/assessment-config';
import { requireActiveUser } from '@/utils/auth';
import LearnPlayerPanel from '@/components/learn/LearnPlayerPanel';
import StartAssessmentButton from '@/components/learn/StartAssessmentButton';
import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Course | getcertificate.today',
  description: 'Watch a course and take the AI assessment it unlocks at 80%.',
};

export default async function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Sign-in + admin-suspension gate (a suspended account cannot keep learning).
  const user = await requireActiveUser();

  const rows = await db
    .select()
    .from(learningItemsTable)
    .where(and(eq(learningItemsTable.id, id), eq(learningItemsTable.user_id, user.id)));
  const item = rows[0];
  if (!item) notFound();

  const [assessmentRows, attemptRows] = await Promise.all([
    db
      .select({
        id: assessmentsTable.id,
        source: assessmentsTable.source,
        // Count only - the questions themselves stay server-side.
        questionCount: sql<number>`jsonb_array_length(${assessmentsTable.questions})`,
      })
      .from(assessmentsTable)
      .where(eq(assessmentsTable.learning_item_id, item.id)),
    db
      .select({
        score: attemptsTable.score,
        passed: attemptsTable.passed,
        created_at: attemptsTable.created_at,
      })
      .from(attemptsTable)
      .where(and(eq(attemptsTable.learning_item_id, item.id), eq(attemptsTable.user_id, user.id)))
      .orderBy(attemptsTable.created_at),
  ]);

  const assessment = assessmentRows[0] ?? null;
  const attempts = attemptRows;
  const unlocked = item.progress_percent >= UNLOCK_PERCENT;
  const title = item.title ?? 'YouTube video';
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null;
  const passed = attempts.some((a) => a.passed);
  // Live admin settings drive the assessment copy on this page.
  const { passScore, assessmentQuestionCount, maxAttemptsPerWindow } = await getSettings();
  // An existing assessment reports its stored count (it may predate this video's
  // runtime, or a settings change); only a quiz that has not been generated yet
  // is previewed at the count its runtime will produce.
  const questionCount = assessment
    ? Number(assessment.questionCount)
    : assessmentQuestionCountForDuration(item.duration_seconds, assessmentQuestionCount);

  return (
    <main className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Link
          href="/dashboard/learning"
          className="inline-flex items-center gap-2 text-sm font-semibold text-clay transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to My Learning
        </Link>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_0.9fr]">
          {/* Player column */}
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Now learning</p>
            <h1 className="mt-1 font-fraunces text-2xl font-black text-ink sm:text-3xl">{title}</h1>
            {item.author && <p className="mt-1 text-sm text-clay">{item.author}</p>}

            <div className="mt-5">
              <LearnPlayerPanel
                youtubeId={item.youtube_id}
                itemId={item.id}
                startSeconds={item.position_seconds}
                title={title}
                initialPercent={item.progress_percent}
                initialWatchedSeconds={item.watched_seconds}
                durationSeconds={item.duration_seconds}
              />
            </div>
          </div>

          {/* Assessment column */}
          <aside className="min-w-0">
            <div className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink">
                  {unlocked ? (
                    <Sparkles aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <LockKeyhole aria-hidden="true" className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="font-fraunces text-xl font-bold text-ink">AI Assessment</h2>
                  <p className="mt-1 text-sm text-clay">
                    {unlocked
                      ? `You have unlocked the assessment. ${questionCount} questions, ${passScore}% to pass.`
                      : `Watch ${UNLOCK_PERCENT}% of this course to unlock the assessment. You are at ${item.progress_percent}%.`}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                {unlocked ? (
                  <StartAssessmentButton
                    itemId={item.id}
                    hasAssessment={Boolean(assessment)}
                    passScore={passScore}
                    questionCount={questionCount}
                    maxAttemptsPerWindow={maxAttemptsPerWindow}
                  />
                ) : (
                  <div>
                    <button
                      type="button"
                      disabled
                      aria-describedby="gate-explanation"
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Take assessment</span>
                      <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <p id="gate-explanation" className="mt-2 text-xs text-clay">
                      Complete {UNLOCK_PERCENT}% of the video first - this gate is enforced on the
                      server, so the assessment stays locked until your progress is recorded.
                    </p>
                  </div>
                )}
              </div>

              {assessment && (
                <p className="mt-3 text-xs text-clay">
                  {' '}
                  Questions generated from:{' '}
                  <span className="font-semibold text-ink">
                    {assessment.source === 'transcriptapi'
                      ? 'video transcript'
                      : assessment.source === 'captions'
                        ? 'video captions'
                        : 'video metadata'}
                  </span>
                </p>
              )}

              {attempts.length > 0 && (
                <div className="mt-6 border-t border-sandline pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-clay">
                    Your attempts
                  </h3>
                  <ul className="mt-3 flex flex-col gap-2">
                    {attempts.map((attempt, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm"
                      >
                        <span className="text-clay">
                          Attempt {index + 1} ·{' '}
                          {attempt.created_at.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span
                          className={
                            attempt.passed ? 'font-bold text-green-700' : 'font-bold text-clay'
                          }
                        >
                          {attempt.score}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  {bestScore !== null && (
                    <p className="mt-3 text-xs text-clay">
                      Best score:{' '}
                      <span className={passed ? 'font-bold text-green-700' : 'font-bold text-ink'}>
                        {bestScore}%
                      </span>
                      {passed ? ' · Passed' : ` · ${passScore}% needed to pass`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
