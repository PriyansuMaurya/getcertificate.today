'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { startFromVideo, type StartFromVideoState } from '@/app/landing-actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-terracotta px-6 text-[15px] font-bold text-cream transition-[background-color,transform] duration-150 hover:bg-terracotta-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:shrink-0"
    >
      {pending ? 'Starting…' : 'Generate & Start'}
    </button>
  );
}

export default function HeroStartForm() {
  const [state, formAction] = useActionState<StartFromVideoState, FormData>(startFromVideo, {
    message: '',
  });
  // `state.message` outlives the problem it describes: until the next submit it
  // stays set, so a visitor who fixes their link would keep being told the field
  // is invalid. Local dirtiness is what actually clears it. Reset on submit so a
  // repeat failure with an untouched field is flagged again.
  const [dirty, setDirty] = useState(false);

  return (
    <form action={formAction} onSubmit={() => setDirty(false)} className="w-full">
      {/* One field and one button, with nothing between them: the certificate
          below is this composition's one big gesture, so the field should read
          as a single obvious action rather than a row of controls. */}
      {/* The container carries the focus affordance rather than the input: a
          border shift plus a ring, so the state is never signalled by a
          low-contrast colour swap alone. */}
      {/* min-height rather than a fixed 70px: 1px border + 10px padding + the
          48px controls already reach exactly 70, so a hard height has no slack
          to give and cannot grow with user font scaling. The floor keeps the
          specified height while letting the card breathe if the content does. */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-sandline bg-white p-2.5 shadow-figma-pro transition-colors focus-within:border-terracotta focus-within:ring-2 focus-within:ring-terracotta/30 sm:min-h-[70px] sm:flex-row sm:items-center sm:gap-3">
        {/* `sm:flex-1` stays scoped to the row layout: stacked, the field already
            stretches to the card's width, and an unscoped `flex-1` would grow it
            down the column rather than across it. */}
        <div className="flex min-w-0 sm:flex-1">
          {/* Deliberately narrower than the placeholder: this is the field's
              accessible name, so it describes what the field accepts today.
              The placeholder's "or playlist" is a promise the parser does not
              keep yet, and the name should not repeat it. */}
          <label htmlFor="hero-youtube-url" className="sr-only">
            YouTube video link
          </label>
          {/* type="text" rather than type="url" and no `required`, both on
              purpose: the browser's own checks would pre-empt the action with a
              generic tooltip for an empty or malformed field, so every failure
              is routed through startFromVideo and answerable in the page's
              voice. The placeholder is the only instruction this field gets, so
              it is set at full `clay` (5.4:1 on white) instead of the usual
              faded hint. */}
          <input
            id="hero-youtube-url"
            name="youtubeUrl"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a YouTube video or playlist link here..."
            aria-invalid={Boolean(state.message) && !dirty}
            aria-describedby={state.message ? 'hero-youtube-error' : undefined}
            onChange={() => setDirty(true)}
            className="h-12 min-w-0 flex-1 bg-transparent px-4 text-[15px] text-ink placeholder:text-clay focus:outline-none"
          />
        </div>

        <SubmitButton />
      </div>

      {/* A live region that exists before the message does: swapping the text
          inside an already-mounted element is announced reliably, whereas
          toggling `role="alert"` onto a node is not. Rendered sr-only while
          empty so it contributes nothing to the layout.

          The entrance is a CSS animation (`.field-error-in`) rather than a Motion
          one, so the global prefers-reduced-motion rule in globals.css collapses
          it to a single frame without any JS branch. It runs when the class appears
          with the first message; a later message replacing it does not replay it,
          which is right - the region is already being read. */}
      <p
        id="hero-youtube-error"
        role="alert"
        className={
          state.message ? 'field-error-in mt-3 text-[13px] font-medium text-terracotta' : 'sr-only'
        }
      >
        {state.message}
      </p>
    </form>
  );
}
