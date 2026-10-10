'use client';

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

/**
 * Read-only referral URL field with Copy and Share actions. The code is also
 * shown on its own for people who want to read it out loud.
 *
 * Clipboard access can be unavailable (insecure context / permissions), so the
 * fallback selects the text and tells the user to copy manually rather than
 * failing silently. Share uses the native share sheet when the browser offers
 * one and falls back to copying the link, so the action is never a dead end.
 */
export default function CopyReferralLink({ code, url }: { code: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [failed, setFailed] = useState(false);

  const shareText = `Join me on getcertificate.today - turn YouTube learning into verifiable certificates. ${url}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  async function handleShare() {
    // Native share sheet (mobile + some desktop browsers). AbortError means the
    // user dismissed the sheet - not a failure, so it is ignored (and announced).
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'getcertificate.today',
          text: shareText,
          url,
        });
        setFailed(false);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Fall through to copying when the share sheet is unavailable/errors.
      }
    }
    await handleCopy();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Paper rather than cream: the pill sits on the cream share panel, so the
          fill has to differ from it for the code to read as a chip. */}
      <div className="flex items-center gap-2 self-start rounded-full border border-sandline bg-paper px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-clay">Your code</span>
        <span className="font-mono text-sm font-bold tracking-widest text-ink">{code}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Read-only text rather than an <input>: a native input never wraps, so
            on narrow phones the link was clipped inside the field. select-all
            keeps one click or tap enough to grab the whole link by hand. */}
        <p className="flex min-h-11 min-w-0 select-all items-center rounded-lg border border-sandline bg-paper px-3.5 py-2 font-mono text-sm leading-relaxed text-ink sm:flex-1">
          {/* Naming the field for screen readers: a <p> cannot take aria-label. */}
          <span className="sr-only">Your referral link</span>
          <span className="min-w-0 break-all">{url}</span>
        </p>
        {/* Icon-only squares (44px, matching the field height). With no visible
            label the accessible name has to come from aria-label, and the copied
            / shared state is announced by the live region below rather than by the
            label, so the names stay stable. */}
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy referral link"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-cream transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Copy aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share referral link"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border-[1.5px] border-ink text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <Share2 aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>

      <p aria-live="polite" className="min-h-4 text-xs text-clay">
        {failed
          ? 'Copying is unavailable in this browser - select the link above and copy it manually.'
          : copied
            ? 'Link copied to your clipboard.'
            : shared
              ? 'Share menu opened.'
              : 'Anyone who signs up through this link is attributed to you.'}
      </p>
    </div>
  );
}
