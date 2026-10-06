'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LearnPlayer from './LearnPlayer';
import { watchedMinutes } from '@/utils/watch-progress';

/**
 * Client wrapper around the player: keeps a live progress bar and calls
 * `router.refresh()` when the server-confirmed percent moves so the
 * server-rendered assessment gate (≥80%) unlocks without a manual reload.
 */
export default function LearnPlayerPanel({
  youtubeId,
  itemId,
  startSeconds,
  title,
  initialPercent,
  initialWatchedSeconds,
  durationSeconds,
}: {
  youtubeId: string;
  itemId: string;
  startSeconds: number;
  title: string;
  initialPercent: number;
  initialWatchedSeconds: number;
  durationSeconds: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState(initialPercent);
  const [watched, setWatched] = useState(initialWatchedSeconds);
  const lastRefreshedRef = useRef(initialPercent);

  function handleProgress(next: number, nextWatchedSeconds: number) {
    setPercent(next);
    setWatched(nextWatchedSeconds);
    // Refresh the RSC tree at most every 5% so the gate unlocks promptly
    // without spamming the server on each sample.
    if (next >= lastRefreshedRef.current + 5 || (next >= 80 && lastRefreshedRef.current < 80)) {
      lastRefreshedRef.current = next;
      router.refresh();
    }
  }

  const totalMinutes = durationSeconds > 0 ? Math.round(durationSeconds / 60) : 0;

  return (
    <div>
      <LearnPlayer
        youtubeId={youtubeId}
        itemId={itemId}
        startSeconds={startSeconds}
        title={title}
        initialPercent={initialPercent}
        initialWatchedSeconds={initialWatchedSeconds}
        onProgress={handleProgress}
      />

      <div className="mt-5 rounded-2xl border border-sandline bg-paper p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-clay">Watch progress</h2>
          <span className="font-fraunces text-xl font-black text-ink">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Watch progress"
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-linen"
        >
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-clay">
          <span className="font-semibold text-ink">{watchedMinutes(watched)} min watched</span>
          {totalMinutes > 0 ? ` of ${totalMinutes} min` : ''} · only time you actually play counts,
          so skipping ahead does not add credit. Progress saves automatically and survives reloads.
        </p>
      </div>
    </div>
  );
}
