'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import LearnPlayer from './LearnPlayer';

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
}: {
  youtubeId: string;
  itemId: string;
  startSeconds: number;
  title: string;
  initialPercent: number;
}) {
  const router = useRouter();
  const [percent, setPercent] = useState(initialPercent);
  const lastRefreshedRef = useRef(initialPercent);

  function handleProgress(next: number) {
    setPercent(next);
    // Refresh the RSC tree at most every 5% so the gate unlocks promptly
    // without spamming the server on each sample.
    if (next >= lastRefreshedRef.current + 5 || (next >= 80 && lastRefreshedRef.current < 80)) {
      lastRefreshedRef.current = next;
      router.refresh();
    }
  }

  return (
    <div>
      <LearnPlayer
        youtubeId={youtubeId}
        itemId={itemId}
        startSeconds={startSeconds}
        title={title}
        initialPercent={initialPercent}
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
          Progress is saved automatically every few seconds and survives reloads.
        </p>
      </div>
    </div>
  );
}
