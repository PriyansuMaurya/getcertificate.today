'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, options: Record<string, unknown>) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YTPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  addEventListener: (event: string, handler: () => void) => void;
};

// Loads the YouTube IFrame API once per page. Progress is sampled from the
// player and handed to the parent, which owns server persistence.
let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('Failed to load the YouTube player script.'));
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

export default function YouTubePlayer({
  youtubeId,
  startSeconds,
  title,
  onSample,
}: {
  youtubeId: string;
  startSeconds: number;
  title: string;
  /** Called with (positionSeconds, durationSeconds) while playing. */
  onSample: (position: number, duration: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  useEffect(() => {
    let cancelled = false;
    let sampleTimer: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !containerRef.current || !window.YT) return;

        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: youtubeId,
          playerVars: {
            start: Math.max(0, Math.floor(startSeconds)),
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (event: { target: YTPlayer }) => {
              const player = event.target;
              // Sample every 5s while the tab is visible (throttled server writes).
              sampleTimer = setInterval(() => {
                if (document.hidden) return;
                try {
                  const position = player.getCurrentTime();
                  const duration = player.getDuration();
                  if (duration > 0) onSampleRef.current(position, duration);
                } catch {
                  // Player torn down mid-sample — ignore.
                }
              }, 5000);
            },
          },
        });
      })
      .catch((err: Error) => {
        console.error('[learn] player load failed:', err.message);
      });

    return () => {
      cancelled = true;
      if (sampleTimer) clearInterval(sampleTimer);
      try {
        playerRef.current?.destroy();
      } catch {
        // Already destroyed.
      }
      playerRef.current = null;
    };
    // Re-create the player only when the video changes.
  }, [youtubeId, startSeconds]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-sandline bg-ink">
      {/* The IFrame API replaces this div with the player iframe; the wrapper
          keeps layout stable and carries the accessible region label. */}
      <div
        ref={containerRef}
        role="region"
        aria-label={`YouTube video player: ${title}`}
        className="h-full w-full"
      />
    </div>
  );
}
