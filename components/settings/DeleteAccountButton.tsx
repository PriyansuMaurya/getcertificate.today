'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteAccount } from '@/app/dashboard/settings/actions';

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Yes, delete everything'}
    </button>
  );
}

/**
 * Two-step destructive action: reveal confirmation, then submit the server
 * deleteAccount action. Surfacing the pending state and the server-returned
 * message (e.g. "cancel your subscription first") keeps the flow honest.
 */
export default function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [formState, formAction] = useActionState(deleteAccount, { message: '' });

  if (!confirming) {
    return (
      <div className="flex flex-col items-start gap-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-10 items-center justify-center rounded-lg border-[1.5px] border-red-600 px-5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
        >
          Delete my account
        </button>
        {formState?.message && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {formState.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-sm leading-[1.6] text-clay">
        This permanently removes your profile, learning history, assessment attempts, and
        certificates. It cannot be undone. If you have a paid subscription, cancel it in the billing
        portal first.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <DeleteSubmitButton />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex h-10 items-center justify-center rounded-lg border border-sandline px-5 text-sm font-bold text-ink transition-colors hover:bg-ink/5"
        >
          Cancel
        </button>
      </div>
      {formState?.message && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {formState.message}
        </p>
      )}
    </form>
  );
}
