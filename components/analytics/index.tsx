import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import DeferredGTM from './DeferredGTM';

// Root analytics extension point. Gates live here so disabled integrations
// render nothing and future providers have a single place to be added.
export function AnalyticsComponents() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <>
      <Analytics />
      <SpeedInsights />
      {gtmId ? <DeferredGTM gtmId={gtmId} /> : null}
    </>
  );
}
