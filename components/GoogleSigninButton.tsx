'use client';

import { useEffect, useRef, useState } from 'react';
import { FaGoogle } from 'react-icons/fa';
import { finishGoogleSignIn, signInWithGoogle } from '@/app/auth/actions';
import { createClient } from '@/utils/supabase/client';

type GoogleSigninButtonProps = {
  actionLabel: 'Sign in' | 'Sign up';
  /** Public Google OAuth client ID (safe to expose to the browser). */
  clientId: string;
};

type GsiCredentialResponse = {
  credential?: string;
  error?: string;
};

type GsiButtonOptions = {
  theme?: string;
  size?: string;
  text?: string;
  type?: string;
  shape?: string;
  width?: number;
  locale?: string;
};

type GsiIdApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GsiCredentialResponse) => void;
    nonce?: string;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: GsiButtonOptions) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GsiIdApi;
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const SCRIPT_TIMEOUT_MS = 8000;
const RESIZE_DEBOUNCE_MS = 200;
const RESIZE_THRESHOLD_PX = 8;
// GIS renders a 0x0 iframe when the origin is rejected for the client ID
// (403 "given origin is not allowed") - poll for real size before trusting it.
const GIS_SIZE_POLL_MS = 100;
const GIS_RENDER_TIMEOUT_MS = 2000;
const GIS_MIN_SIZE_PX = 10;

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GSI script failed')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GSI script failed'));
    document.head.appendChild(script);
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates the raw nonce plus the SHA-256 hex hash Supabase Auth expects to
 * receive from Google (raw nonce goes to signInWithIdToken, hashed nonce goes
 * to google.accounts.id.initialize).
 */
async function generateNoncePair(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  return { raw, hashed: await sha256Hex(raw) };
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export default function GoogleSigninButton({ actionLabel, clientId }: GoogleSigninButtonProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const rawNonceRef = useRef('');
  const [pending, setPending] = useState(false);
  // 'gis' once Google's iframe is live: the styled button stays visible but
  // is disabled so every click/Enter follows the single GIS flow (no legacy
  // redirect that would show the supabase.co domain again).
  const [mode, setMode] = useState<'legacy' | 'gis'>('legacy');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = overlayRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    let observer: ResizeObserver | undefined;
    let lastWidth = 0;

    const handleCredential = async (response: GsiCredentialResponse) => {
      if (!response.credential) {
        setError('Google sign-in was cancelled or failed. Please try again.');
        return;
      }
      setPending(true);
      setError(null);
      try {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.credential,
          nonce: rawNonceRef.current || undefined,
        });
        if (signInError) {
          console.error('Google ID-token sign-in failed:', signInError.message);
          setError(signInError.message);
          setPending(false);
          return;
        }
        // Session cookie is now written (ssr writes document.cookie synchronously);
        // finish bootstrap + land on onboarding/dashboard.
        await finishGoogleSignIn();
      } catch (err) {
        // The server action's redirect() surfaces as a NEXT_REDIRECT digest -
        // navigation is already in flight, so don't treat it as a failure.
        if (isNextRedirectError(err)) return;
        console.error('Google sign-in failed:', err);
        setError('Something went wrong completing Google sign-in. Please try again.');
        setPending(false);
      }
    };

    const renderGisButton = (width: number) => {
      const gsi = window.google?.accounts?.id;
      if (!gsi || cancelled) return;
      try {
        // initialize() once per effect run; resize re-renders only call renderButton.
        if (!initialized) {
          gsi.initialize({
            client_id: clientId,
            callback: handleCredential,
            nonce: hashedNonce,
            cancel_on_tap_outside: false,
          });
          initialized = true;
        }
        container.innerHTML = '';
        lastWidth = width;
        gsi.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: actionLabel === 'Sign up' ? 'signup_with' : 'signin_with',
          type: 'standard',
          width,
        });
        watchForIframe();
      } catch (err) {
        // GIS failed to render (bad client id, blocked, etc.) - stay on the
        // legacy redirect flow, which keeps working.
        console.error('Google Identity Services failed to render:', err);
      }
    };

    // MutationObserver instead of a fixed poll: iframe can render at any time
    // (slow network) - start size-watching whenever it appears.
    const watchForIframe = () => {
      if (cancelled) return;
      if (container.querySelector('iframe')) {
        iframeObserver?.disconnect();
        iframeObserver = undefined;
        armGisSizeCheck();
        if (!observer) {
          observer = new ResizeObserver(() => {
            if (cancelled) return;
            const width = Math.round(container.getBoundingClientRect().width);
            if (width > 0 && Math.abs(width - lastWidth) >= RESIZE_THRESHOLD_PX) {
              clearTimeout(resizeTimer);
              resizeTimer = setTimeout(() => {
                if (!cancelled) renderGisButton(width);
              }, RESIZE_DEBOUNCE_MS);
            }
          });
          observer.observe(container);
        }
        return;
      }
      if (!iframeObserver) {
        iframeObserver = new MutationObserver(() => watchForIframe());
        iframeObserver.observe(container, { childList: true, subtree: true });
      }
    };

    // Only switch to 'gis' mode (styled button disabled, clicks owned by the
    // Google overlay) once the iframe actually has size. A 0x0 iframe means
    // Google rejected the origin - drop GIS entirely and keep the styled
    // button on the legacy redirect flow instead of leaving it dead.
    const armGisSizeCheck = () => {
      if (gisLive || gisAbandoned || sizeCheckTimer) return;
      const startedAt = Date.now();
      const tick = () => {
        sizeCheckTimer = undefined;
        if (cancelled || gisLive || gisAbandoned) return;
        const frame = container.querySelector('iframe');
        const rect = frame?.getBoundingClientRect();
        if (rect && rect.width >= GIS_MIN_SIZE_PX && rect.height >= GIS_MIN_SIZE_PX) {
          gisLive = true;
          setMode('gis');
          return;
        }
        if (Date.now() - startedAt >= GIS_RENDER_TIMEOUT_MS) {
          // Give up for good: ResizeObserver must not re-enter polling.
          gisAbandoned = true;
          observer?.disconnect();
          observer = undefined;
          container.innerHTML = '';
          return;
        }
        sizeCheckTimer = setTimeout(tick, GIS_SIZE_POLL_MS);
      };
      // First check synchronous: shrink the window where both the sized GIS
      // iframe and the enabled styled button are interactive.
      tick();
    };

    let hashedNonce = '';
    let initialized = false;
    let gisLive = false;
    let gisAbandoned = false;
    let sizeCheckTimer: ReturnType<typeof setTimeout> | undefined;
    let iframeObserver: MutationObserver | undefined;

    const start = async () => {
      try {
        const noncePair = await generateNoncePair();
        if (cancelled) return;
        rawNonceRef.current = noncePair.raw;
        hashedNonce = noncePair.hashed;

        await Promise.race([
          loadGsiScript(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GSI script load timed out')), SCRIPT_TIMEOUT_MS)
          ),
        ]);
        if (cancelled) return;

        const width = Math.round(container.getBoundingClientRect().width);
        if (width > 0) {
          renderGisButton(width);
        }
      } catch (err) {
        // GIS unavailable (blocked, offline, timeout) - silently keep the
        // legacy redirect flow so Google sign-in still works.
        console.warn('Google Identity Services unavailable, using redirect flow:', err);
      }
    };

    void start();

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      clearTimeout(sizeCheckTimer);
      observer?.disconnect();
      iframeObserver?.disconnect();
      container.innerHTML = '';
      setMode('legacy');
    };
  }, [clientId, actionLabel]);

  return (
    <div className="basis-full">
      <div className="group relative">
        <form action={signInWithGoogle}>
          <button
            type="submit"
            aria-label={`${actionLabel} with Google`}
            disabled={pending || mode === 'gis'}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-sandline bg-cream text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-paper group-hover:border-ink group-hover:bg-paper ${
              // Dim only while actually signing in; in gis mode the button is
              // disabled (clicks belong to Google's overlay) but must keep
              // full opacity + pointer cursor so it never looks dead.
              pending ? 'cursor-wait opacity-50' : mode === 'gis' ? 'cursor-pointer' : ''
            }`}
          >
            <FaGoogle aria-hidden="true" className="h-4 w-4" />
            <span>{pending ? 'Signing in…' : `${actionLabel} with Google`}</span>
          </button>
        </form>
        {/*
          Invisible GIS click layer. The styled button below stays the visual
          and the legacy redirect fallback: if GIS never renders an iframe,
          clicks fall through (pointer-events: none) to the form above. When
          the iframe exists, pointer-events:auto on the iframe routes clicks
          to Google's popup instead - Google shows this app's own domain.
        */}
        <div
          ref={overlayRef}
          role="presentation"
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-0 [&_.g_id_signin]:pointer-events-auto [&_iframe]:pointer-events-auto"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-500/10 p-2.5 text-center text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
