'use client';

import { useMemo, useState, useTransition } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  checkAnswer,
  submitAssessment,
  type AnswerFeedback,
  type AssessmentActionState,
} from '@/app/learn/actions';
import { Loader2, Send, CheckCircle2, XCircle } from 'lucide-react';

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
          ? 'All questions answered - submit when ready.'
          : `Answer all questions to submit (${answered}/${total} answered).`}
      </p>
    </div>
  );
}

/**
 * Assessment form (DESIGN §13): one-column radio groups, visible labels,
 * disabled submit with explanatory hint until every question is answered.
 *
 * Instant feedback: committing a choice calls the `checkAnswer` server action,
 * which validates server-side and returns correctness + explanations - the
 * correct answer never reaches the client before a choice is made (FR-D3).
 * Once feedback is shown the question locks (the answer is graded); the final
 * score is still computed server-side on submit (RULES §9.3).
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
  const [feedback, setFeedback] = useState<Record<number, AnswerFeedback>>({});
  const [checkError, setCheckError] = useState('');
  const [isChecking, startTransition] = useTransition();

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.index] !== undefined).length,
    [questions, answers]
  );

  const handleSelect = (questionIndex: number, choice: number) => {
    if (isChecking || feedback[questionIndex]) return; // one commit per question
    setCheckError('');
    startTransition(async () => {
      try {
        const result = await checkAnswer(itemId, questionIndex, choice);
        if ('message' in result) {
          setCheckError(result.message);
          return;
        }
        setAnswers((prev) => ({ ...prev, [questionIndex]: choice }));
        setFeedback((prev) => ({ ...prev, [questionIndex]: result }));
      } catch {
        setCheckError('Could not check that answer. Please try selecting it again.');
      }
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="itemId" value={itemId} />

      <ol className="flex flex-col gap-6">
        {questions.map((q, position) => {
          const fb = feedback[q.index];
          const locked = Boolean(fb);
          return (
            <li key={q.index} className="rounded-2xl border border-sandline bg-paper p-5 sm:p-6">
              <fieldset disabled={isChecking && !locked}>
                {locked && answers[q.index] !== undefined && (
                  // Locked radios are disabled, and disabled controls are not
                  // submitted - mirror the committed answer so submitAssessment
                  // still receives `q<index>`.
                  <input type="hidden" name={`q${q.index}`} value={String(answers[q.index])} />
                )}
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
                    const showAsCorrect = locked && choiceIndex === fb?.correctIndex;
                    const showAsWrong = locked && selected && !fb?.correct;
                    return (
                      <label
                        key={choiceIndex}
                        className={
                          showAsCorrect
                            ? 'flex cursor-default items-start gap-3 rounded-lg border border-green-700 bg-green-700/10 px-4 py-3 text-sm font-semibold text-ink'
                            : showAsWrong
                              ? 'flex cursor-default items-start gap-3 rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-sm font-semibold text-ink'
                              : selected
                                ? 'flex cursor-pointer items-start gap-3 rounded-lg border border-ink bg-cream px-4 py-3 text-sm font-semibold text-ink transition-colors'
                                : 'flex cursor-pointer items-start gap-3 rounded-lg border border-sandline bg-cream px-4 py-3 text-sm text-ink transition-colors hover:border-clay'
                        }
                      >
                        <input
                          type="radio"
                          name={choiceName}
                          value={String(choiceIndex)}
                          checked={selected}
                          disabled={locked}
                          onChange={() => handleSelect(q.index, choiceIndex)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1A1A1A]"
                        />
                        <span>{choice}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Instant feedback: correctness + explanations, server-validated. */}
              {isChecking && !fb && (
                <p className="mt-3 flex items-center gap-2 text-sm text-clay" aria-live="polite">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Checking your answer…
                </p>
              )}
              {fb && (
                <div
                  role="status"
                  aria-live="polite"
                  className={
                    fb.correct
                      ? 'mt-4 rounded-lg border border-green-700/40 bg-green-700/10 p-4'
                      : 'mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4'
                  }
                >
                  <p
                    className={
                      fb.correct
                        ? 'flex items-center gap-2 text-sm font-bold text-green-700'
                        : 'flex items-center gap-2 text-sm font-bold text-red-700'
                    }
                  >
                    {fb.correct ? (
                      <>
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                        Correct - that answer is right.
                      </>
                    ) : (
                      <>
                        <XCircle aria-hidden="true" className="h-4 w-4" />
                        Incorrect.
                      </>
                    )}
                  </p>

                  {!fb.correct && (
                    <div className="mt-2 flex flex-col gap-1 text-sm text-ink">
                      <p>
                        <span className="font-semibold">Your answer:</span> {fb.selectedText}
                      </p>
                      {fb.selectedExplanation && (
                        <p className="text-clay">
                          <span className="font-semibold text-ink">Why it&apos;s wrong:</span>{' '}
                          {fb.selectedExplanation}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex flex-col gap-1 text-sm text-ink">
                    <p>
                      <span className="font-semibold">Correct answer:</span> {fb.correctText}
                    </p>
                    {fb.explanation && (
                      <p className="text-clay">
                        <span className="font-semibold text-ink">Why it&apos;s correct:</span>{' '}
                        {fb.explanation}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {checkError && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 p-3 text-center text-sm font-medium text-red-700"
        >
          {checkError}
        </p>
      )}

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
