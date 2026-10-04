import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import ConsentGate from './ConsentGate';

// Root analytics extension point. Gates live here so disabled integrations
// render nothing and future providers have a single place to be added.
// Vercel Analytics/SpeedInsights are cookieless (no consent required);
// Google Tag Manager is consent-gated behind ConsentGate (ePrivacy/GDPR).
export function AnalyticsComponents() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <>
      <Analytics />
      <SpeedInsights />
      {gtmId ? <ConsentGate gtmId={gtmId} /> : null}
    </>
  );
}
