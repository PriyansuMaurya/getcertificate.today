'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { mintFromAttempt, type AssessmentActionState } from '@/app/learn/actions';
import { Award, Loader2 } from 'lucide-react';

function MintButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          <span>Minting…</span>
        </>
      ) : (
        <>
          <Award aria-hidden="true" className="h-4 w-4" />
          <span>Mint credential</span>
        </>
      )}
    </button>
  );
}

export default function MintCredentialButton({ attemptId }: { attemptId: string }) {
  const initialState: AssessmentActionState = { message: '' };
  const [formState, formAction] = useActionState(mintFromAttempt, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-2">
      <input type="hidden" name="attemptId" value={attemptId} />
      <MintButton />
      {formState.message && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {formState.message}
        </p>
      )}
    </form>
  );
}
