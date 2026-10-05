'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { startAssessment, type AssessmentActionState } from '@/app/learn/actions';
import { Sparkles, Loader2 } from 'lucide-react';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          <span>Preparing your assessment…</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <Sparkles aria-hidden="true" className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

export default function StartAssessmentButton({
  itemId,
  hasAssessment,
  passScore,
  assessmentQuestionCount,
  maxAttemptsPerWindow,
}: {
  itemId: string;
  hasAssessment: boolean;
  passScore: number;
  assessmentQuestionCount: number;
  maxAttemptsPerWindow: number;
}) {
  const initialState: AssessmentActionState = { message: '' };
  const [formState, formAction] = useActionState(startAssessment, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value={itemId} />
      <SubmitButton label={hasAssessment ? 'Take assessment' : 'Generate & start assessment'} />
      {formState.message && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {formState.message}
        </p>
      )}
      <p className="mt-2 text-xs text-clay">
        {hasAssessment
          ? `${passScore}% to pass · ${maxAttemptsPerWindow} attempts per week · scoring happens on the server.`
          : `Generation takes a few seconds. ${assessmentQuestionCount} questions · ${passScore}% to pass · ${maxAttemptsPerWindow} attempts per week.`}
      </p>
    </form>
  );
}
