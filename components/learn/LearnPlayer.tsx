'use client';

import { useEffect, useRef } from 'react';
import YouTubePlayer, { type PlayerSample } from './YouTubePlayer';
import { saveProgress } from '@/app/dashboard/actions';
import {
  MAX_PENDING_WATCH_SECONDS,
  PROGRESS_FLUSH_INTERVAL_MS,
  trimPendingWatchRanges,
  type WatchRange,
} from '@/utils/watch-progress';

/**
 * Bridges the pure player component to the `saveProgress` server action.
 *
 * The player emits the spans it actually played; they are buffered here and
 * flushed to the server every `PROGRESS_FLUSH_INTERVAL_MS`, plus best-effort on
 * tab hide/unload. Over-budget flushes (possible after a background tab or a
 * network gap) are kept and retried, so a legitimate learner never loses
 * watched seconds; terminal failures drop the buffer.
 */
export default function LearnPlayer({
  youtubeId,
  itemId,
  startSeconds,
  title,
  initialPercent,
  initialWatchedSeconds,
  onProgress,
}: {
  youtubeId: string;
  itemId: string;
  startSeconds: number;
  title: string;
  initialPercent: number;
  initialWatchedSeconds: number;
  /** Called with the latest server-confirmed percent + unique watched seconds. */
  onProgress: (percent: number, watchedSeconds: number) => void;
}) {
  const pendingRef = useRef<WatchRange[]>([]);
  const inFlightRef = useRef(false);
  const lastFlushRef = useRef(0);
  const lastPercentRef = useRef(initialPercent);
  const watchedSecondsRef = useRef(initialWatchedSeconds);
  const lastSampleRef = useRef<{ position: number; duration: number } | null>(null);

  function flush(position: number, duration: number) {
    const segments = pendingRef.current;
    if (segments.length === 0) return;
    pendingRef.current = [];
    inFlightRef.current = true;
    lastFlushRef.current = Date.now();
    lastSampleRef.current = { position, duration };

    saveProgress(itemId, position, duration, segments)
      .then((result) => {
        if (result.ok) {
          lastPercentRef.current = Math.max(lastPercentRef.current, result.percent);
          watchedSecondsRef.current = Math.max(watchedSecondsRef.current, result.watchedSeconds);
          onProgress(lastPercentRef.current, watchedSecondsRef.current);
        } else if (result.retryable) {
          // Over budget: keep the spans and retry once the clock has advanced.
          pendingRef.current = segments.concat(pendingRef.current);
        }
        // Non-retryable (signed out / item gone): drop the buffer.
      })
      .catch((err: Error) => {
        // Network error: keep the spans and retry.
        pendingRef.current = segments.concat(pendingRef.current);
        console.error('[learn] progress save failed:', err.message);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }

  function handleSample({ position, duration, watched }: PlayerSample) {
    if (duration <= 0) return;
    lastSampleRef.current = { position, duration };

    if (watched) {
      // Bound the buffer by *seconds* (not span count - a 2x span is ~10s) if
      // flushes keep being rejected, keeping it under the server's minimum
      // budget so a backlog is always eventually accepted rather than looping.
      pendingRef.current = trimPendingWatchRanges(
        [...pendingRef.current, watched],
        MAX_PENDING_WATCH_SECONDS
      );
    }

    if (inFlightRef.current || pendingRef.current.length === 0) return;
    if (Date.now() - lastFlushRef.current < PROGRESS_FLUSH_INTERVAL_MS) return;
    flush(position, duration);
  }

  // Best-effort flush when the tab is hidden or the page is being unloaded, so
  // the last partial window of watched time is not silently lost.
  useEffect(() => {
    function flushPending() {
      const sample = lastSampleRef.current;
      if (sample && pendingRef.current.length > 0) flush(sample.position, sample.duration);
    }
    function onVisibility() {
      if (document.hidden) flushPending();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushPending);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushPending);
    };
    // flush reads only refs, so it is stable for this component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YouTubePlayer
      youtubeId={youtubeId}
      startSeconds={startSeconds}
      title={title}
      onSample={handleSample}
    />
  );
}
