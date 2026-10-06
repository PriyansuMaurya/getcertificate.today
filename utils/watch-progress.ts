/**
 * Unique watched-time tracking for the learning player (FR-C4).
 *
 * Progress is no longer derived from the player's current timestamp - that let
 * a learner seek to the end and instantly bank a full completion. Instead the
 * client reports the contiguous spans it actually played, and the server keeps
 * the canonical union of those spans on the learning item. Total progress is
 * the sum of the union's lengths, so re-watching or scrubbing back and forth
 * can never double-count, and a forward jump contributes nothing.
 *
 * This module is intentionally dependency-free so both the 'use server' action
 * and the client components can share the exact same arithmetic.
 */

/** A half-open-ish [start, end) span of seconds that was actually played. */
export type WatchRange = { start: number; end: number };

/** YouTube's IFrame player tops out at 2x, leaving headroom for jitter. */
export const MAX_PLAYBACK_RATE = 2;
/** How often the player samples its position (keep in sync with YouTubePlayer). */
export const PLAYER_SAMPLE_INTERVAL_MS = 5000;
/** How often buffered samples are flushed to the server (3 polls). */
export const PROGRESS_FLUSH_INTERVAL_MS = 15000;
/**
 * Upper bound on client-side unflushed watch seconds. Kept below the server's
 * minimum per-request budget so a backlogged flush is never permanently
 * rejected (over-budget samples are retried, not dropped).
 */
export const MAX_PENDING_WATCH_SECONDS = 30;
/**
 * A poll delta counts as continuous play (rather than a seek) only when it is
 * within the wall-clock time actually elapsed, times the max playback rate,
 * plus this slack.
 */
export const CLIENT_CONTINUOUS_TOLERANCE_SECONDS = 2;
/**
 * Seconds of new credit one server request may add per second of wall clock
 * since the previous sample. Multiplicative (not additive) on purpose: a flat
 * tolerance would let a client that floods requests extract unbounded credit
 * regardless of how fast it calls. 2x playback plus a little jitter headroom.
 */
export const WATCH_BUDGET_RATE = MAX_PLAYBACK_RATE + 0.5;
/** Elapsed budget for the first sample after a page load (last_watched_at null). */
export const SERVER_MIN_ELAPSED_SECONDS = 15;
/** Long idle gaps are clamped so a returning client cannot bank unlimited credit. */
export const SERVER_MAX_ELAPSED_SECONDS = 60;
/** Defensive cap on how many spans a single request may carry. */
export const MAX_WATCH_RANGES = 2000;

/**
 * Coerce an untrusted value into a valid span within [0, duration].
 * Returns null for malformed or sub-second spans (which carry no real credit).
 */
export function normalizeWatchRange(input: unknown, duration: number): WatchRange | null {
  if (!input || typeof input !== 'object') return null;
  const { start, end } = input as { start?: unknown; end?: unknown };
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  const upper = duration > 0 ? duration : Math.max(0, end);
  const s = Math.min(Math.max(0, start), upper);
  const e = Math.min(Math.max(0, end), upper);
  if (e - s < 1) return null;
  return { start: s, end: e };
}

/**
 * Union a set of spans: sort, then coalesce anything overlapping or touching.
 * The result is the minimal disjoint, ascending representation, so the total
 * length equals the number of unique seconds watched exactly once.
 */
export function mergeWatchRanges(ranges: WatchRange[]): WatchRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: WatchRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const current = merged[merged.length - 1];
    const next = sorted[i];
    if (next.start <= current.end) {
      if (next.end > current.end) current.end = next.end;
    } else {
      merged.push({ ...next });
    }
  }
  return merged;
}

/** Total unique seconds represented by a merged span list. */
export function totalWatchedSeconds(ranges: WatchRange[]): number {
  return Math.round(ranges.reduce((sum, r) => sum + Math.max(0, r.end - r.start), 0));
}

/** Completion percentage from unique watched seconds (floor, clamped 0..100). */
export function watchPercent(watchedSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  const raw = Math.floor((watchedSeconds / durationSeconds) * 100);
  return Math.max(0, Math.min(100, raw));
}

/** Watched seconds rendered as whole minutes (for display). */
export function watchedMinutes(watchedSeconds: number): number {
  return Math.max(0, Math.round(watchedSeconds / 60));
}

/** Sum of spans, used to keep the client's pending buffer bounded. */
export function pendingSeconds(ranges: WatchRange[]): number {
  return ranges.reduce((sum, r) => sum + Math.max(0, r.end - r.start), 0);
}

/**
 * Drop the oldest spans until the buffered total fits `maxSeconds`, always
 * keeping at least one span. Bounds by *seconds* (not span count): at 2x a span
 * is ~10s, so a count-based cap could exceed the server's minimum budget and
 * loop forever on rejection. Used by components/learn/LearnPlayer.
 */
export function trimPendingWatchRanges(ranges: WatchRange[], maxSeconds: number): WatchRange[] {
  let start = 0;
  let total = pendingSeconds(ranges);
  while (ranges.length - start > 1 && total > maxSeconds) {
    total -= Math.max(0, ranges[start].end - ranges[start].start);
    start += 1;
  }
  // Always return a fresh array (never the caller's reference).
  return ranges.slice(start);
}

/**
 * Decide whether a poll-to-poll move counts as continuous watching.
 *
 * A forward move contributes a span only when the player is actually playing
 * and the move is no faster than real playback (up to MAX_PLAYBACK_RATE) within
 * the wall-clock time that elapsed. A larger jump is a seek: it returns null so
 * the skipped seconds are never credited. Used by components/learn/YouTubePlayer.
 */
export function detectPlayedSpan(input: {
  prevPosition: number | null;
  position: number;
  elapsedSeconds: number;
  isPlaying: boolean;
}): WatchRange | null {
  const { prevPosition, position, elapsedSeconds, isPlaying } = input;
  if (!isPlaying || prevPosition === null) return null;
  if (!(position > prevPosition)) return null;
  const maxAdvance =
    Math.max(0, elapsedSeconds) * MAX_PLAYBACK_RATE + CLIENT_CONTINUOUS_TOLERANCE_SECONDS;
  if (position - prevPosition > maxAdvance) return null;
  return { start: prevPosition, end: position };
}

export type WatchReconcileInput = {
  /** Canonical spans already stored on the item (untrusted - re-validated here). */
  storedRanges: WatchRange[];
  /** Server-stored unique watched seconds (monotonic floor). */
  storedWatchedSeconds: number;
  /** Total video length in seconds (0 = not yet known). */
  duration: number;
  /** Untrusted spans proposed by the client for the spans just played. */
  segments: unknown[];
  /** Wall-clock seconds since the previous sample; null for the very first one. */
  elapsedSeconds: number | null;
};

export type WatchReconcileResult = {
  /** False when the new credit exceeded the wall-clock budget (retryable). */
  accepted: boolean;
  watchedSeconds: number;
  ranges: WatchRange[];
  addedSeconds: number;
  percent: number;
};

/**
 * Server-side reconciliation of a progress sample (FR-C4).
 *
 * Unions the client's proposed spans with the stored canonical set, computes the
 * unique watched seconds, and accepts the update only when the newly added
 * seconds fit inside the wall-clock budget (`WATCH_BUDGET_RATE` seconds of
 * credit per second elapsed since the previous sample). This is what makes a
 * single "I watched the whole 60-minute video" payload - or skipping to the end
 * - contribute nothing, while a genuine sequence of small spans accumulates.
 *
 * Pure and side-effect free so it is unit-testable (utils/watch-progress.test.ts).
 */
export function reconcileWatchProgress(input: WatchReconcileInput): WatchReconcileResult {
  const { storedRanges: rawStored, storedWatchedSeconds, duration, segments } = input;

  let storedRanges = mergeWatchRanges(
    (Array.isArray(rawStored) ? rawStored : [])
      .map((range) => normalizeWatchRange(range, duration))
      .filter((range): range is WatchRange => range !== null)
  );
  // Guard a legacy row whose watched_seconds floor exceeds what its ranges
  // justify: represent the floor as a span so the two stay consistent and an
  // accepted sample can never snap the total back down.
  if (storedWatchedSeconds > totalWatchedSeconds(storedRanges)) {
    const floorSpan = normalizeWatchRange({ start: 0, end: storedWatchedSeconds }, duration);
    if (floorSpan) storedRanges = mergeWatchRanges([...storedRanges, floorSpan]);
  }
  const previousWatched = Math.max(storedWatchedSeconds, totalWatchedSeconds(storedRanges));

  const proposed = (Array.isArray(segments) ? segments : [])
    .slice(0, MAX_WATCH_RANGES)
    .map((segment) => normalizeWatchRange(segment, duration))
    .filter((range): range is WatchRange => range !== null);

  const merged = duration > 0 ? mergeWatchRanges([...storedRanges, ...proposed]) : storedRanges;
  const mergedWatched = totalWatchedSeconds(merged);
  const addedSeconds = Math.max(0, mergedWatched - previousWatched);

  const elapsedSeconds =
    input.elapsedSeconds === null
      ? SERVER_MIN_ELAPSED_SECONDS
      : Math.min(SERVER_MAX_ELAPSED_SECONDS, Math.max(0, input.elapsedSeconds));
  const accepted = addedSeconds <= elapsedSeconds * WATCH_BUDGET_RATE;

  const watchedSeconds = accepted ? mergedWatched : previousWatched;
  const ranges = accepted ? merged : storedRanges;

  return {
    accepted,
    watchedSeconds,
    ranges,
    addedSeconds,
    percent: watchPercent(watchedSeconds, duration),
  };
}
