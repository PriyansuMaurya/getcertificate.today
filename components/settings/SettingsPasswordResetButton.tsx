'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendPasswordResetEmail, type SettingsActionState } from '@/app/dashboard/settings/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-ink px-6 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Email me a reset link'}
    </button>
  );
}

/**
 * Secondary security action: emails a password reset link so a user who has
 * forgotten their current password can set a new one without leaving Settings.
 */
export default function SettingsPasswordResetButton() {
  const initialState: SettingsActionState = { message: '' };
  const [formState, formAction] = useActionState(sendPasswordResetEmail, initialState);

  return (
    <div className="border-t border-sandline pt-5">
      <p className="text-sm font-bold text-ink">Forgot your password?</p>
      <p className="mt-1 text-sm text-clay">
        We will email a secure link you can use to choose a new password.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
        <SubmitButton />
        {formState.message && (
          <p
            role="status"
            className={
              formState.success
                ? 'text-sm font-medium text-green-700'
                : 'text-sm font-medium text-red-600'
            }
          >
            {formState.message}
          </p>
        )}
      </form>
    </div>
  );
}
