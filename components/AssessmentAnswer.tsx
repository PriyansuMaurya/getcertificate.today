'use client';

import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

/** Props for the AssessmentAnswer component */
export interface AssessmentAnswerProps {
  /** Whether the answer is currently being checked */
  isChecking: boolean;
  /** Whether the answer was correct */
  isCorrect: boolean | null;
  /** The answer text selected by the user */
  selectedAnswer: string;
  /** The correct answer text */
  correctAnswer: string;
  /** Explanation for why the answer is correct or incorrect */
  explanation: string;
  /** Callback when the user wants to retry */
  onRetry: () => void;
}

/**
 * AssessmentAnswer - Displays the result of an assessment answer.
 * Shows instant feedback after a user selects an answer, indicating
 * whether the answer was correct or incorrect with explanations.
 */
export default function AssessmentAnswer({
  isChecking,
  isCorrect,
  selectedAnswer,
  correctAnswer,
  explanation,
  onRetry,
}: AssessmentAnswerProps) {
  return (
    <div className="rounded-2xl border border-sandline bg-paper p-6 sm:p-8">
      <fieldset>
        {isChecking && !isCorrect && (
          <p className="mt-3 flex items-center gap-2 text-sm text-clay" aria-live="polite">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Checking your answer…
          </p>
        )}

        {isCorrect !== null && (
          <div
            role="status"
            aria-live="polite"
            className={
              isCorrect
                ? 'mt-4 rounded-lg border border-green-700/40 bg-green-700/10 p-4'
                : 'mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-4'
            }
          >
            <p
              className={
                isCorrect
                  ? 'flex items-center gap-2 text-sm font-bold text-green-700'
                  : 'flex items-center gap-2 text-sm font-bold text-red-700'
              }
            >
              {isCorrect ? (
                <>
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  Correct.
                </>
              ) : (
                <>
                  <XCircle aria-hidden="true" className="h-4 w-4" />
                  Incorrect.
                </>
              )}
            </p>

            {!isCorrect && (
              <div className="mt-2 flex flex-col gap-1 text-sm text-ink">
                <p>
                  <span className="font-semibold">Your answer:</span> {selectedAnswer}
                </p>
                {explanation && (
                  <p className="text-clay">
                    <span className="font-semibold text-ink">Why it's wrong:</span>{' '}
                    {explanation}
                  </p>
                )}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-1 text-sm text-ink">
              <p>
                <span className="font-semibold">Correct answer:</span> {correctAnswer}
              </p>
              {explanation && (
                <p className="text-clay">
                  <span className="font-semibold text-ink">Why it's correct:</span>{' '}
                  {explanation}
                </p>
              )}
            </div>
          </div>
        )}

        {!isChecking && isCorrect === null && (
          <p className="mt-3 text-sm text-clay">
            Select an answer to see feedback.
          </p>
        )}

        {isCorrect === null && (
          <button
            onClick={onRetry}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
          >
            <span>Retry assessment</span>
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </fieldset>
    </div>
  )
}