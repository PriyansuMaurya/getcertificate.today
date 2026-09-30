'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitAssessment, type AssessmentActionState } from '@/app/learn/actions';
import { Loader2, Send } from 'lucide-react';

export type PublicQuestion = {
  index: number;
  prompt: string;
  choices: string[];
};

function SubmitButton({ answered, total }: { answered: number; total: number }) {
  const { pending } = useFormStatus();
  const ready = answered === total;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={!ready || pending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            <span>Scoring your attempt…</span>
          </>
        ) : (
          <>
            <span>Submit answers</span>
            <Send aria-hidden="true" className="h-4 w-4" />
          </>
        )}
      </button>
      <p className="text-center text-xs text-clay" aria-live="polite">
        {ready
          ? 'All questions answered — submit when ready.'
          : `Answer all questions to submit (${answered}/${total} answered).`}
      </p>
    </div>
  );
}

/**
 * Assessment form (DESIGN §13): one-column radio groups, visible labels,
 * disabled submit with explanatory hint until every question is answered.
 * Correct answers never reach the client — scoring is server-side.
 */
export default function AssessmentForm({
  itemId,
  questions,
  remainingAttempts,
}: {
  itemId: string;
  questions: PublicQuestion[];
  remainingAttempts: number;
}) {
  const initialState: AssessmentActionState = { message: '' };
  const [formState, formAction] = useActionState(submitAssessment, initialState);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.index] !== undefined).length,
    [questions, answers]
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="itemId" value={itemId} />

      <ol className="flex flex-col gap-6">
        {questions.map((q, position) => (
          <li key={q.index} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
            <fieldset>
              <legend className="w-full">
                <span className="flex items-start gap-3">
                  <span className="font-fraunces text-lg font-bold text-sand">
                    {String(position + 1).padStart(2, '0')}
                  </span>
                  <span className="font-fraunces text-lg font-bold leading-snug text-ink">
                    {q.prompt}
                  </span>
                </span>
              </legend>

              <div className="mt-4 flex flex-col gap-2.5">
                {q.choices.map((choice, choiceIndex) => {
                  const choiceName = `q${q.index}`;
                  const selected = answers[q.index] === choiceIndex;
                  return (
                    <label
                      key={choiceIndex}
                      className={
                        selected
                          ? 'flex cursor-pointer items-start gap-3 rounded-lg border border-ink bg-cream px-4 py-3 text-sm font-semibold text-ink transition-colors'
                          : 'flex cursor-pointer items-start gap-3 rounded-lg border border-sandline bg-cream px-4 py-3 text-sm text-ink transition-colors hover:border-clay'
                      }
                    >
                      <input
                        type="radio"
                        name={choiceName}
                        value={String(choiceIndex)}
                        checked={selected}
                        onChange={() => setAnswers((prev) => ({ ...prev, [q.index]: choiceIndex }))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1A1A1A]"
                      />
                      <span>{choice}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {formState.message && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 p-3 text-center text-sm font-medium text-red-700"
        >
          {formState.message}
        </p>
      )}

      <SubmitButton answered={answeredCount} total={questions.length} />

      <p className="text-center text-xs text-clay">
        {remainingAttempts} of 3 attempts remaining this week · scoring happens on the server · 70%
        to pass.
      </p>
    </form>
  );
}
