'use client';

import { Linkedin } from 'lucide-react';

type ShareOnLinkedInButtonProps = {
  /** Absolute URL of the certificate page (the link LinkedIn previews). */
  url: string;
  /** Suggested post text, copied to the clipboard for the user to paste. */
  text: string;
};

/**
 * LinkedIn share button (FR-E3 share flow).
 *
 * LinkedIn's web share endpoint (`/sharing/share-offsite/?url=`) accepts only a
 * URL - pre-filled commentary via query params was removed to curb spam. So the
 * post text is copied to the clipboard instead, and the link preview card text
 * is controlled by this page's `og:title` / `og:description` (see generateMetadata).
 */
export default function ShareOnLinkedInButton({ url, text }: ShareOnLinkedInButtonProps) {
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard unavailable (permissions/insecure context) - the share dialog
      // still opens; the user can write their own post text.
    }

    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=700,height=600');
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ink px-6 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <Linkedin aria-hidden="true" className="h-4 w-4" />
      Share on LinkedIn
    </button>
  );
}
