import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq, gte } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { db } from '@/utils/db/db';
import { assessmentsTable, attemptsTable, learningItemsTable } from '@/utils/db/schema';
import {
  MAX_ATTEMPTS_PER_WINDOW,
  PASS_SCORE,
  UNLOCK_PERCENT,
  attemptWindowCutoff,
} from '@/utils/credentials';
import AssessmentForm, { type PublicQuestion } from '@/components/learn/AssessmentForm';
import { ArrowLeft, LockKeyhole } from 'lucide-react';

export const metadata = {
  title: 'Assessment | getcertificate.today',
  description: 'Take your AI-generated assessment.',
};

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const itemRows = await db
    .select()
    .from(learningItemsTable)
    .where(and(eq(learningItemsTable.id, id), eq(learningItemsTable.user_id, user.id)));
  const item = itemRows[0];
  if (!item) notFound();

  const assessmentRows = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.learning_item_id, id));
  const assessment = assessmentRows[0];
  if (!assessment) redirect(`/learn/${id}`);

  // Server-authoritative gate re-check on every load (FR-C5 AC3).
  if (item.progress_percent < UNLOCK_PERCENT) {
    redirect(`/learn/${id}`);
  }

  const windowAttempts = await db
    .select({ id: attemptsTable.id })
    .from(attemptsTable)
    .where(
      and(
        eq(attemptsTable.assessment_id, assessment.id),
        eq(attemptsTable.user_id, user.id),
        gte(attemptsTable.created_at, attemptWindowCutoff())
      )
    );

  const remainingAttempts = Math.max(0, MAX_ATTEMPTS_PER_WINDOW - windowAttempts.length);

  // Strip correct answers - only prompt + choices reach the client (FR-D3 AC2).
  const questions: PublicQuestion[] = assessment.questions.map((q, index) => ({
    index,
    prompt: q.prompt,
    choices: q.choices,
  }));

  return (
    <main className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
      <div className="mx-auto max-w-[840px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Link
          href={`/learn/${id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-clay transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to course
        </Link>

        <div className="mt-6 flex flex-col gap-2">
          <p className="text-[13px] font-bold uppercase tracking-wider text-sand">AI Assessment</p>
          <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">
            {item.title ?? 'Course assessment'}
          </h1>
          <p className="text-sm text-clay sm:text-base">
            {questions.length} questions · {PASS_SCORE}% to pass · your answers are scored on the
            server.
          </p>
        </div>

        <div className="mt-8">
          {remainingAttempts > 0 ? (
            <AssessmentForm
              itemId={id}
              questions={questions}
              remainingAttempts={remainingAttempts}
            />
          ) : (
            <div className="rounded-2xl border border-sandline bg-paper p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-linen text-ink">
                <LockKeyhole aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-fraunces text-xl font-bold text-ink">
                Attempt limit reached
              </h2>
              <p className="mt-2 text-sm text-clay">
                You have used all {MAX_ATTEMPTS_PER_WINDOW} attempts for this week. Come back after
                the cooldown to try again.
              </p>
              <Link
                href={`/learn/${id}`}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-lg border border-ink px-5 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream"
              >
                Back to course
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
