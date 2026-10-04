'use client';

import Link from 'next/link';

/**
 * Cookie choice cookie: first-party, 180 days, SameSite=Lax. Values:
 * 'accepted' (GA4/GTM may load) or 'declined' (essential cookies only).
 * Written by the banner; read here to gate GoogleTagManager on every visit.
 */
const COOKIE_CONSENT_COOKIE = 'cookie_consent';

const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 days

export type CookieConsentValue = 'accepted' | 'declined';

/** Read the consent cookie in the browser (null before a choice is made). */
export function readCookieConsent(): CookieConsentValue | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_CONSENT_COOKIE}=`));
  const value = match ? decodeURIComponent(match.slice(COOKIE_CONSENT_COOKIE.length + 1)) : null;
  return value === 'accepted' || value === 'declined' ? value : null;
}

function writeCookieConsent(value: CookieConsentValue) {
  document.cookie = `${COOKIE_CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

/**
 * Banner shown until a choice is made. The parent (ConsentGate) unmounts it
 * as soon as onChoice fires, so no local state is needed here - the parent
 * owns the consent state and mounts GTM only on 'accepted'. Vercel
 * Analytics/SpeedInsights are cookieless and stay enabled regardless -
 * only Google Tag Manager is consent-gated.
 */
export default function CookieConsent({ onChoice }: { onChoice: (v: CookieConsentValue) => void }) {
  const decide = (value: CookieConsentValue) => {
    writeCookieConsent(value);
    onChoice(value);
  };

  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sandline bg-paper/95 p-4 backdrop-blur-sm sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-[420px] sm:rounded-2xl sm:border sm:shadow-figma-pro"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-[1.5] text-clay">
          We use essential cookies to keep you signed in. With your permission, we also use Google
          Analytics to understand how the site is used. See our{' '}
          <Link
            href="/cookie-policy"
            className="font-semibold text-ink underline underline-offset-4 hover:text-clay"
          >
            Cookie Policy
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            className="font-semibold text-ink underline underline-offset-4 hover:text-clay"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-ink px-4 text-sm font-bold text-cream transition-colors hover:bg-ink/90"
          >
            Accept analytics
          </button>
          <button
            type="button"
            onClick={() => decide('declined')}
            className="flex h-10 flex-1 items-center justify-center rounded-lg border-[1.5px] border-ink px-4 text-sm font-bold text-ink transition-colors hover:bg-ink/5"
          >
            Essential only
          </button>
        </div>
      </div>
    </section>
  );
}
