'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  checkUsernameAvailability,
  completeOnboarding,
  type UsernameAvailability,
} from '@/app/auth/actions';
import { ArrowRightIcon, CheckIcon } from '@/components/icons';
import DateOfBirthField from '@/components/DateOfBirthField';

// Debounce for the live availability check - fast enough to feel live, slow
// enough to avoid a query per keystroke.
const USERNAME_CHECK_DEBOUNCE_MS = 400;

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type AvailabilityState = UsernameAvailability['status'] | 'idle' | 'checking';

const HINT_STYLES: Record<AvailabilityState, string> = {
  idle: 'text-clay',
  checking: 'text-clay',
  invalid: 'text-clay',
  available: 'text-emerald-600',
  taken: 'text-red-600',
  error: 'text-clay',
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90 disabled:opacity-50"
    >
      <span>{pending ? 'Saving profile…' : 'Continue to Dashboard'}</span>
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

  const [username, setUsername] = useState(defaultUsername ?? '');
  // Controlled so a failed submit (e.g. username taken) never wipes what the
  // user already typed - uncontrolled defaultValue fields get reset when the
  // action returns an error state.
  const [firstName, setFirstName] = useState(defaultFirstName ?? '');
  const [lastName, setLastName] = useState(defaultLastName ?? '');
  const [dob, setDob] = useState(defaultDob ?? '');
  // Result of the most recent completed check, tagged with the value it was
  // for so results for stale input are simply shown as 'checking'.
  const [checkResult, setCheckResult] = useState<{
    value: string;
    status: UsernameAvailability['status'];
  } | null>(null);
  const checkSeq = useRef(0);
  // Bumped on every submit so a failed submit (e.g. server-side race on the
  // username) re-runs the check instead of leaving a stale hint on screen.
  const [recheckToken, setRecheckToken] = useState(0);
  // Client-side dob validation message (the calendar's hidden input ignores
  // HTML `required`, so we surface the error ourselves instead of round-tripping).
  const [dobError, setDobError] = useState('');

  // Debounced live availability check as the user types. Only async setState
  // (inside the timer callback) - the displayed state is DERIVED during render
  // below, so there is no synchronous setState in this effect.
  useEffect(() => {
    const value = username.trim();
    if (!USERNAME_RE.test(value)) return;

    const seq = ++checkSeq.current;
    const timer = setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      // A monotonically increasing sequence number discards stale responses
      // that resolve out of order.
      if (seq === checkSeq.current) {
        setCheckResult({ value, status: result.status });
      }
    }, USERNAME_CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [username, recheckToken]);

  // Derived display state: idle (empty) -> invalid (format) -> checking
  // (typing, no matching result yet) -> latest result for this exact value.
  const trimmed = username.trim();
  const availability: AvailabilityState = !trimmed
    ? 'idle'
    : !USERNAME_RE.test(trimmed)
      ? 'invalid'
      : checkResult?.value === trimmed
        ? checkResult.status
        : 'checking';

  // Clear the stale verdict before re-submitting so the hint can never
  // contradict a fresh server response (and so an 'error' hint retries).
  const submitAction = async (formData: FormData) => {
    if (!dob) {
      setDobError('Please select your date of birth.');
      return;
    }
    setDobError('');
    setCheckResult(null);
    setRecheckToken((t) => t + 1);
    await formAction(formData);
  };

  const hintText =
    availability === 'invalid'
      ? '3-20 characters: lowercase letters, numbers, underscores only.'
      : availability === 'checking'
        ? 'Checking availability…'
        : availability === 'available'
          ? 'This username is available.'
          : availability === 'taken'
            ? 'That username is already taken. Please choose another one.'
            : availability === 'error'
              ? "Couldn't check availability - please make sure it's unique."
              : '3-20 characters: lowercase letters, numbers, underscores. Used for your public profile & verification URL.';

  return (
    <form action={submitAction} className="flex flex-col gap-4">
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
          autoComplete="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          aria-describedby="username-hint"
          aria-invalid={availability === 'taken' || availability === 'invalid'}
          className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <p
          id="username-hint"
          role="status"
          aria-live="polite"
          className={`flex items-start gap-1.5 text-xs ${HINT_STYLES[availability]}`}
        >
          {availability === 'available' && <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{hintText}</span>
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
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
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
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="h-11 rounded-lg border border-sandline bg-cream px-3.5 text-sm text-ink placeholder:text-clay/60 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dob" className="text-xs font-bold uppercase tracking-wider text-clay">
          Date of birth
        </label>
        <DateOfBirthField
          value={dob}
          onChange={(v) => {
            setDob(v);
            setDobError('');
          }}
        />
        <p className="text-xs text-clay">Must be at least 13 years old.</p>
      </div>

      <SubmitButton />

      {(dobError || formState?.message) && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 p-2.5 text-center text-sm font-medium text-red-700"
        >
          {dobError || formState.message}
        </p>
      )}
    </form>
  );
}
