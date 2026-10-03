'use client';

import { useEffect, useState } from 'react';
import { GoogleTagManager } from '@next/third-parties/google';

/**
 * Defers Google Tag Manager until after the window `load` event.
 *
 * gtm.js (~120KB transfer) competes with the fonts/CSS/images on the
 * critical path during the LCP window. Mounting it post-load keeps that
 * bandwidth free for first paint; GTM still fires its pageview when it
 * initializes (late, but reliably). The noscript fallback lives in the
 * root layout and is unaffected.
 */
export default function DeferredGTM({ gtmId }: { gtmId: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLoad = () => setReady(true);
    if (document.readyState === 'complete') {
      // Already loaded: defer the state update a tick so the effect body
      // never calls setState synchronously (react-hooks/set-state-in-effect).
      const tick = window.setTimeout(onLoad, 0);
      return () => window.clearTimeout(tick);
    }
    window.addEventListener('load', onLoad, { once: true });
    // Safety net: never leave GTM permanently unmounted if `load` is
    // starved by a hung asset.
    const safety = window.setTimeout(onLoad, 10_000);
    return () => {
      window.removeEventListener('load', onLoad);
      window.clearTimeout(safety);
    };
  }, []);

  // Server render and the first client render both stay null - no hydration
  // mismatch; GTM mounts as an update after load.
  if (!ready) return null;
  return <GoogleTagManager gtmId={gtmId} />;
}
