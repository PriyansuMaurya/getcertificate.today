'use client';

import { useEffect, useState } from 'react';
import CookieConsent, { readCookieConsent, type CookieConsentValue } from './CookieConsent';
import DeferredGTM from './DeferredGTM';

/**
 * Gates Google Tag Manager behind cookie consent (ePrivacy/GDPR: analytics
 * cookies need prior opt-in). GTM only mounts once the stored choice is
 * 'accepted'; declining (or never choosing) means it never loads.
 * The banner itself renders only while no choice is stored, and hides
 * immediately once the visitor decides.
 */
export default function ConsentGate({ gtmId }: { gtmId: string }) {
  // undefined = choice not read yet (first client render), so neither the
  // banner nor GTM flashes before we know the stored value - no hydration
  // mismatch because the server renders null either way.
  const [choice, setChoice] = useState<CookieConsentValue | null | undefined>(undefined);

  useEffect(() => {
    // Read the stored choice post-mount; defer the state update a tick so the
    // effect body never calls setState synchronously (react-hooks/set-state-in-effect)
    // - the same pattern DeferredGTM uses.
    const tick = window.setTimeout(() => setChoice(readCookieConsent()), 0);
    return () => window.clearTimeout(tick);
  }, []);

  if (choice === undefined) return null;

  return (
    <>
      {choice === null ? <CookieConsent onChoice={setChoice} /> : null}
      {choice === 'accepted' ? <DeferredGTM gtmId={gtmId} /> : null}
    </>
  );
}
