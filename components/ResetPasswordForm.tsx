'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { resetPassword } from '@/app/auth/actions';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowRightIcon } from '@/components/icons';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
    >
      <span>{pending ? 'Updating…' : 'Update Password'}</span>
      <ArrowRightIcon className="h-4 w-4 shrink-0" />
    </button>
  );
}

function GetCodeHiddenInput() {
  const searchParams = useSearchParams();
  return <input type="hidden" name="code" value={searchParams.get('code') ?? ''} />;
}

export default function ResetPasswordForm() {
  const initialState = {
    message: '',
  };
  const [formState, formAction] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-clay">
          New Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          placeholder="••••••••"
          minLength={8}
          autoComplete="new-password"
          required
          className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirm_password"
          className="text-xs font-bold uppercase tracking-wider text-clay"
        >
          Confirm Password
        </label>
        <input
          id="confirm_password"
          type="password"
          name="confirm_password"
          placeholder="••••••••"
          minLength={8}
          autoComplete="new-password"
          required
          className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <Suspense>
          <GetCodeHiddenInput />
        </Suspense>
      </div>

      <SubmitButton />

      {formState?.message && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 p-2.5 text-center text-sm font-medium text-red-700"
        >
          {formState.message}
        </p>
      )}
    </form>
  );
}
