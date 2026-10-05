import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, X } from 'lucide-react';
import { requireAdmin } from '../../require-admin';
import { getAdminAssessmentDetail, statusChip } from '../assessments-data';
import AssessmentActions from '@/components/admin/AssessmentActions';

export const metadata: Metadata = {
  title: 'Assessment details',
};

const fmtDate = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '\u2014';

const detailStatusLabel: Record<string, string> = {
  ready: 'Generated from transcript',
  failed: 'Failed \u00b7 generated from title only',
  legacy: 'Legacy \u00b7 captions',
};

export default async function AdminAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const assessment = await getAdminAssessmentDetail(id);
  if (!assessment) notFound();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link
        href="/admin/assessments"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-clay transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All assessments
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-fraunces text-2xl font-black text-ink sm:text-3xl">
              {assessment.courseTitle}
            </h1>
            <span
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${statusChip[assessment.status]}`}
            >
              {detailStatusLabel[assessment.status]}
            </span>
          </div>
          <p className="mt-1 break-all text-sm text-clay">
            {assessment.kind === 'playlist' ? 'Playlist' : 'Video'} {'\u00b7'}{' '}
            {assessment.youtubeId} {'\u00b7'} created {fmtDate(assessment.createdAt)}
          </p>
          <p className="mt-0.5 text-xs text-clay">
            Owned by{' '}
            <Link
              href={`/admin/users/${assessment.user.id}`}
              className="font-semibold text-ink underline-offset-4 hover:underline"
            >
              {assessment.user.displayName}
            </Link>{' '}
            ({assessment.user.email})
          </p>
        </div>

        <AssessmentActions
          assessmentId={assessment.id}
          courseTitle={assessment.courseTitle}
          returnTo="/admin/assessments"
        />
      </div>

      {assessment.status === 'failed' && (
        <div className="mt-6 rounded-2xl border border-red-600/40 bg-red-50 p-4 text-sm font-semibold text-red-700">
          This assessment was generated without a transcript (title/channel only), so its questions
          may not reflect the actual course content. Regenerate it once a transcript is available -
          regenerating is blocked while learner attempts exist.
        </div>
      )}

      {/* Summary strip */}
      <section
        aria-label="Assessment summary"
        className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {[
          { label: 'Questions', value: assessment.questions.length.toLocaleString('en-US') },
          { label: 'Attempts', value: assessment.attemptCount.toLocaleString('en-US') },
          {
            label: 'Certificates',
            value: assessment.credentialCount.toLocaleString('en-US'),
          },
          {
            label: 'Attempts passed',
            value: `${assessment.attempts.filter((a) => a.passed).length} / ${assessment.attemptCount}`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-sandline bg-paper p-5">
            <h2 className="text-sm font-bold text-clay">{label}</h2>
            <p className="mt-2 font-fraunces text-3xl font-black text-ink">{value}</p>
          </div>
        ))}
      </section>

      {/* Every generated question, with correct answers and explanations. */}
      <section
        aria-labelledby="questions-heading"
        className="mt-4 rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
      >
        <h2 id="questions-heading" className="font-fraunces text-xl font-bold text-ink">
          Generated Questions
        </h2>
        <p className="mt-1 text-xs text-clay">
          Correct answers and explanations - the same data the instant-feedback flow reveals after a
          learner commits.
        </p>
        <ol className="mt-5 flex flex-col gap-4">
          {assessment.questions.map((q, qi) => (
            <li key={qi} className="rounded-xl bg-cream p-4 sm:p-5">
              <p className="text-sm font-semibold text-ink">
                <span className="mr-2 font-bold text-clay">Q{qi + 1}.</span>
                {q.prompt}
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {q.choices.map((choice, ci) => {
                  const isCorrect = ci === q.correct;
                  return (
                    <li
                      key={ci}
                      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                        isCorrect ? 'bg-ink font-semibold text-cream' : 'bg-paper text-clay'
                      }`}
                    >
                      {isCorrect ? (
                        <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <X aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 opacity-50" />
                      )}
                      <span>{choice}</span>
                      {isCorrect && (
                        <span className="ml-auto shrink-0 text-[11px] font-bold uppercase">
                          Correct
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {q.explanation && (
                <p className="mt-3 text-xs leading-relaxed text-clay">
                  <span className="font-bold text-ink">Why: </span>
                  {q.explanation}
                </p>
              )}
              {q.choice_explanations && (
                <ul className="mt-2 flex flex-col gap-1">
                  {q.choice_explanations.map((exp, ei) => (
                    <li key={ei} className="text-xs leading-relaxed text-clay">
                      <span className="font-semibold">
                        {ei === q.correct ? 'Correct choice' : `Choice ${ei + 1}`}:{' '}
                      </span>
                      {exp}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Attempts with user answers */}
      <section
        aria-labelledby="attempts-heading"
        className="mt-4 rounded-2xl border border-sandline bg-paper p-5 sm:p-6"
      >
        <h2 id="attempts-heading" className="font-fraunces text-xl font-bold text-ink">
          Learner Attempts
        </h2>
        {assessment.attempts.length === 0 ? (
          <p className="mt-4 text-sm text-clay">
            No attempts yet - regenerating the questions is still allowed.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {assessment.attempts.map((a) => (
              <li key={a.id} className="rounded-xl bg-cream p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{a.userEmail}</p>
                    <p className="mt-0.5 text-xs text-clay">
                      {fmtDate(a.at)} {'\u00b7'} answered [{a.answers.join(', ')}] {'\u00b7'}{' '}
                      {a.correctCount} of {assessment.questions.length} correct
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-ink">{a.score}%</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        a.passed ? 'bg-ink text-cream' : 'bg-red-600 text-white'
                      }`}
                    >
                      {a.passed ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
