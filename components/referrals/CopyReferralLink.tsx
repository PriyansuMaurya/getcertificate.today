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
      <div className="flex items-center gap-2 self-start rounded-full border border-sandline bg-cream px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-clay">Your code</span>
        <span className="font-mono text-sm font-bold tracking-widest text-ink">{code}</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Your referral link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-lg border border-sandline bg-paper px-3.5 font-mono text-sm text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-sm font-bold text-cream transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:flex-none"
          >
            {copied ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border-[1.5px] border-ink px-5 text-sm font-bold text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:flex-none"
          >
            <Share2 aria-hidden="true" className="h-4 w-4" />
            Share
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
