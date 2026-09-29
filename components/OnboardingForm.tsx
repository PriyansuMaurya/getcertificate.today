'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { completeOnboarding } from '@/app/auth/actions';
import { ArrowRightIcon } from '@/components/icons';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
    >
      <span>{pending ? 'Saving profile...' : 'Continue to Dashboard'}</span>
      <ArrowRightIcon className="h-4 w-4 shrink-0" />
    </button>
  );
}

export default function OnboardingForm({
  defaultUsername,
  defaultFirstName,
  defaultLastName,
  defaultDob,
}: {
  defaultUsername?: string;
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultDob?: string;
}) {
  const initialState = {
    message: '',
  };

  const [formState, formAction] = useActionState(completeOnboarding, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-clay">
          Username
        </label>
        <input
          id="username"
          type="text"
          name="username"
          placeholder="johndoe"
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]+"
          defaultValue={defaultUsername}
          required
          className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <p className="text-xs text-clay">
          3-20 characters: lowercase letters, numbers, underscores. Used for your public profile &
          verification URL.
        </p>
      </div>

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
            className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dob" className="text-xs font-bold uppercase tracking-wider text-clay">
          Date of birth
        </label>
        <input
          id="dob"
          type="date"
          name="dob"
          defaultValue={defaultDob}
          max={new Date().toISOString().split('T')[0]}
          required
          className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <p className="text-xs text-clay">Must be at least 13 years old.</p>
      </div>

      <SubmitButton />

      {formState?.message && (
        <p className="rounded-lg bg-red-500/10 p-2.5 text-center text-sm font-medium text-red-700">
          {formState.message}
        </p>
      )}
    </form>
  );
}
