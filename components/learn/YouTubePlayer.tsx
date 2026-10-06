'use client';

import { useEffect, useRef } from 'react';
import {
  PLAYER_SAMPLE_INTERVAL_MS,
  detectPlayedSpan,
  type WatchRange,
} from '@/utils/watch-progress';

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
  getPlayerState: () => number;
  addEventListener: (event: string, handler: () => void) => void;
};

/** A single progress sample handed to the parent for server persistence. */
export type PlayerSample = {
  position: number;
  duration: number;
  /**
   * The contiguous span played since the previous sample, or null when nothing
   * was played (paused, rewound, or a seek too large to be real playback).
   */
  watched: WatchRange | null;
};

// YT.PlayerState.PLAYING
const PLAYING = 1;

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
  /** Called once per poll while the player is alive. */
  onSample: (sample: PlayerSample) => void;
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
    // Per-player anchor: the last observed position and the wall clock at that
    // observation. A gap that outruns real elapsed time is a seek, not watching.
    let lastPosition: number | null = null;
    let lastTickAt = Date.now();

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
              lastPosition = null;
              lastTickAt = Date.now();
              // Sample every few seconds while the tab is visible (throttled writes).
              sampleTimer = setInterval(() => {
                if (document.hidden) {
                  // No credit while backgrounded, and drop the anchor so the
                  // return from the background is not bridged as watching.
                  lastPosition = null;
                  return;
                }
                try {
                  const position = player.getCurrentTime();
                  const duration = player.getDuration();
                  if (!(duration > 0)) return;

                  const now = Date.now();
                  const elapsedSeconds = Math.max(0, (now - lastTickAt) / 1000);

                  // Only a forward move no faster than real playback (up to the
                  // max rate) counts as continuous watching. A larger jump is a
                  // seek and contributes no span (see detectPlayedSpan).
                  const watched = detectPlayedSpan({
                    prevPosition: lastPosition,
                    position,
                    elapsedSeconds,
                    isPlaying: player.getPlayerState() === PLAYING,
                  });

                  lastPosition = position;
                  lastTickAt = now;
                  onSampleRef.current({ position, duration, watched });
                } catch {
                  // Player torn down mid-sample - ignore.
                }
              }, PLAYER_SAMPLE_INTERVAL_MS);
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
