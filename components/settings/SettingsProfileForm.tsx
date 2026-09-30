'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProfile, type SettingsActionState } from '@/app/dashboard/settings/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save profile'}
    </button>
  );
}

export default function SettingsProfileForm({
  defaultFirstName,
  defaultLastName,
}: {
  defaultFirstName: string;
  defaultLastName: string;
}) {
  const initialState: SettingsActionState = { message: '' };
  const [formState, formAction] = useActionState(updateProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="firstName"
            className="text-xs font-bold uppercase tracking-wider text-clay"
          >
            First name
          </label>
          <input
            id="firstName"
            type="text"
            name="firstName"
            placeholder="John"
            defaultValue={defaultFirstName}
            required
            maxLength={60}
            className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lastName"
            className="text-xs font-bold uppercase tracking-wider text-clay"
          >
            Surname
          </label>
          <input
            id="lastName"
            type="text"
            name="lastName"
            placeholder="Doe"
            defaultValue={defaultLastName}
            required
            maxLength={60}
            className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
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
      </div>
    </form>
  );
}
