'use client';

import { useRef } from 'react';
import YouTubePlayer from './YouTubePlayer';
import { saveProgress } from '@/app/dashboard/actions';

/**
 * Bridges the pure player component to the `saveProgress` server action and
 * surfaces progress changes so the server-rendered gate can refresh.
 */
export default function LearnPlayer({
  youtubeId,
  itemId,
  startSeconds,
  title,
  initialPercent,
  onProgress,
}: {
  youtubeId: string;
  itemId: string;
  startSeconds: number;
  title: string;
  initialPercent: number;
  /** Called with the latest server-confirmed percent (monotonic). */
  onProgress: (percent: number) => void;
}) {
  const lastSavedRef = useRef(initialPercent);
  const inFlightRef = useRef(false);

  function handleSample(position: number, duration: number) {
    if (inFlightRef.current || duration <= 0) return;
    const localPercent = Math.min(100, Math.floor((position / duration) * 100));
    // Skip the round-trip when the visible percent has not moved.
    if (localPercent < lastSavedRef.current) return;

    inFlightRef.current = true;
    saveProgress(itemId, position, duration)
      .then((result) => {
        if (result.ok) {
          lastSavedRef.current = result.percent;
          onProgress(result.percent);
        }
      })
      .catch((err: Error) => {
        console.error('[learn] progress save failed:', err.message);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }

  return (
    <YouTubePlayer
      youtubeId={youtubeId}
      startSeconds={startSeconds}
      title={title}
      onSample={handleSample}
    />
  );
}
