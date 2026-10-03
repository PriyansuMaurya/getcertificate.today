'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addLearningItem, type LearningActionState } from '@/app/dashboard/actions';
import { Plus } from 'lucide-react';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-12 items-center justify-center gap-2 rounded-lg bg-ink px-6 text-sm font-bold text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>{pending ? 'Adding…' : 'Add video'}</span>
      <Plus aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

export default function AddLearningForm() {
  const initialState: LearningActionState = { message: '' };
  const [formState, formAction] = useActionState(addLearningItem, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="youtube-url" className="sr-only">
        YouTube course link
      </label>
      {/* Below sm the container stacks vertically, so `flex-1` must not apply -
          its flex-basis would collapse the input's height to ~21px instead of
          h-12. Cross-axis stretch already makes it full width when stacked. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="youtube-url"
          name="youtubeUrl"
          type="url"
          required
          placeholder="https://www.youtube.com/watch?v=…"
          className="h-12 w-full min-w-0 rounded-lg border border-sandline bg-cream px-4 text-sm text-ink placeholder:text-clay/70 focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink sm:flex-1"
        />
        <SubmitButton />
      </div>
      {formState.message && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {formState.message}
        </p>
      )}
      <p className="text-xs text-clay">
        Paste a YouTube video link (watch or youtu.be). Playlists are coming soon.
      </p>
    </form>
  );
}
