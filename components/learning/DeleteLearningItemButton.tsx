'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteLearningItem, type LearningActionState } from '@/app/dashboard/actions';
import { Trash2 } from 'lucide-react';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-lg bg-red-600 px-2 text-center text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50 sm:text-sm"
    >
      {pending ? 'Deleting…' : children}
    </button>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Delete course"
      className="inline-flex h-11 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-sandline px-1.5 text-xs font-semibold text-clay transition-colors hover:border-red-300 hover:text-red-600 sm:gap-1.5 sm:px-4 sm:text-sm"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
      {/* Icon-only below 315px to fit three cells in one row. */}
      <span className="max-[314px]:hidden">Delete</span>
    </button>
  );
}

export default function DeleteLearningItemButton({
  itemId,
  title,
}: {
  itemId: string;
  title: string;
}) {
  const initialState: LearningActionState = { message: '' };
  const [formState, formAction] = useActionState(deleteLearningItem, initialState);
  const [confirming, setConfirming] = useState(false);

  return (
    <form
      action={formAction}
      className="flex w-full min-w-0 flex-col items-stretch gap-1"
      aria-label={`Delete ${title}`}
    >
      <input type="hidden" name="itemId" value={itemId} />
      {confirming ? (
        <span className="flex w-full flex-col gap-2">
          {/* Short label: the sm+ delete cell is only ~82px wide. */}
          <SubmitButton>Confirm</SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-lg border border-sandline px-1.5 text-xs font-semibold text-clay transition-colors hover:border-ink hover:text-ink sm:px-4 sm:text-sm"
          >
            Cancel
          </button>
        </span>
      ) : (
        <DeleteButton onClick={() => setConfirming(true)} />
      )}
      {/* max-w caps the message's max-content width - the action grid has
          shrink-0, so an unwrapped error string would otherwise widen the
          whole page at sm+. */}
      {formState.message && (
        <p role="alert" className="max-w-[240px] break-words text-xs font-medium text-red-600">
          {formState.message}
        </p>
      )}
    </form>
  );
}
