import { GoogleTagManager } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Root analytics extension point. Gates live here so disabled integrations
// render nothing and future providers have a single place to be added.
export function AnalyticsComponents() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <>
      <Analytics />
      <SpeedInsights />
      {gtmId ? <GoogleTagManager gtmId={gtmId} /> : null}
    </>
  );
}
