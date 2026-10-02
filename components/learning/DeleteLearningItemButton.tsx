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
      className="inline-flex h-11 items-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-sandline px-4 text-sm font-semibold text-clay transition-colors hover:border-red-300 hover:text-red-600"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
      Delete
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
      className="inline-flex flex-col items-start gap-1"
      aria-label={`Delete ${title}`}
    >
      <input type="hidden" name="itemId" value={itemId} />
      {confirming ? (
        <span className="inline-flex items-center gap-2">
          <SubmitButton>Confirm delete</SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-11 items-center rounded-lg border border-sandline px-4 text-sm font-semibold text-clay transition-colors hover:border-ink hover:text-ink"
          >
            Cancel
          </button>
        </span>
      ) : (
        <DeleteButton onClick={() => setConfirming(true)} />
      )}
      {formState.message && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {formState.message}
        </p>
      )}
    </form>
  );
}
