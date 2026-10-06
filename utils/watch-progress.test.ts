import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLIENT_CONTINUOUS_TOLERANCE_SECONDS,
  MAX_PENDING_WATCH_SECONDS,
  MAX_PLAYBACK_RATE,
  SERVER_MAX_ELAPSED_SECONDS,
  SERVER_MIN_ELAPSED_SECONDS,
  WATCH_BUDGET_RATE,
  detectPlayedSpan,
  mergeWatchRanges,
  normalizeWatchRange,
  pendingSeconds,
  reconcileWatchProgress,
  totalWatchedSeconds,
  trimPendingWatchRanges,
  watchPercent,
  watchedMinutes,
  type WatchRange,
} from './watch-progress';

describe('mergeWatchRanges', () => {
  it('returns an empty list unchanged', () => {
    assert.deepEqual(mergeWatchRanges([]), []);
  });

  it('keeps a single span', () => {
    assert.deepEqual(mergeWatchRanges([{ start: 0, end: 10 }]), [{ start: 0, end: 10 }]);
  });

  it('sorts disjoint spans ascending', () => {
    assert.deepEqual(
      mergeWatchRanges([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
      ]),
      [
        { start: 0, end: 10 },
        { start: 30, end: 40 },
      ]
    );
  });

  it('merges overlapping spans', () => {
    assert.deepEqual(
      mergeWatchRanges([
        { start: 0, end: 10 },
        { start: 5, end: 15 },
      ]),
      [{ start: 0, end: 15 }]
    );
  });

  it('merges adjacent spans (end === next.start)', () => {
    assert.deepEqual(
      mergeWatchRanges([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
      ]),
      [{ start: 0, end: 20 }]
    );
  });

  it('swallows contained spans', () => {
    assert.deepEqual(
      mergeWatchRanges([
        { start: 0, end: 20 },
        { start: 5, end: 10 },
      ]),
      [{ start: 0, end: 20 }]
    );
  });

  it('coalesces a chain of touching spans', () => {
    assert.deepEqual(
      mergeWatchRanges([
        { start: 0, end: 10 },
        { start: 20, end: 25 },
        { start: 10, end: 20 },
      ]),
      [{ start: 0, end: 25 }]
    );
  });

  it('does not mutate its input', () => {
    const input: WatchRange[] = [
      { start: 0, end: 10 },
      { start: 5, end: 15 },
    ];
    mergeWatchRanges(input);
    assert.deepEqual(input, [
      { start: 0, end: 10 },
      { start: 5, end: 15 },
    ]);
  });
});

describe('totalWatchedSeconds', () => {
  it('returns 0 for no spans', () => {
    assert.equal(totalWatchedSeconds([]), 0);
  });

  it('sums disjoint spans', () => {
    assert.equal(
      totalWatchedSeconds([
        { start: 0, end: 10 },
        { start: 20, end: 30 },
      ]),
      20
    );
  });

  it('counts overlapping seconds only once when merged', () => {
    const merged = mergeWatchRanges([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
    ]);
    assert.equal(totalWatchedSeconds(merged), 15);
  });

  it('rounds fractional spans to whole seconds', () => {
    assert.equal(totalWatchedSeconds([{ start: 0, end: 5.4 }]), 5);
    assert.equal(totalWatchedSeconds([{ start: 0, end: 5.6 }]), 6);
  });
});

describe('watchPercent', () => {
  it('is 0 when the duration is unknown or non-positive', () => {
    assert.equal(watchPercent(100, 0), 0);
    assert.equal(watchPercent(100, -10), 0);
  });

  it('floors the percentage', () => {
    assert.equal(watchPercent(5, 3600), 0);
    assert.equal(watchPercent(324, 720), 45);
    assert.equal(watchPercent(948, 1200), 79);
  });

  it('is 100 when watched reaches the duration', () => {
    assert.equal(watchPercent(3600, 3600), 100);
  });

  it('clamps above 100 and below 0', () => {
    assert.equal(watchPercent(4000, 3600), 100);
    assert.equal(watchPercent(-5, 100), 0);
  });
});

describe('watchedMinutes', () => {
  it('rounds seconds to whole minutes', () => {
    assert.equal(watchedMinutes(0), 0);
    assert.equal(watchedMinutes(29), 0);
    assert.equal(watchedMinutes(30), 1);
    assert.equal(watchedMinutes(1560), 26);
  });

  it('never goes negative', () => {
    assert.equal(watchedMinutes(-42), 0);
  });
});

describe('normalizeWatchRange', () => {
  it('keeps a valid span within the duration', () => {
    assert.deepEqual(normalizeWatchRange({ start: 0, end: 10 }, 100), { start: 0, end: 10 });
  });

  it('clamps a span to [0, duration]', () => {
    assert.deepEqual(normalizeWatchRange({ start: -5, end: 150 }, 100), { start: 0, end: 100 });
  });

  it('drops sub-second spans but keeps exactly 1s', () => {
    assert.equal(normalizeWatchRange({ start: 0, end: 0.5 }, 100), null);
    assert.deepEqual(normalizeWatchRange({ start: 0, end: 1 }, 100), { start: 0, end: 1 });
  });

  it('rejects malformed input', () => {
    assert.equal(normalizeWatchRange(null, 100), null);
    assert.equal(normalizeWatchRange('x', 100), null);
    assert.equal(normalizeWatchRange({}, 100), null);
    assert.equal(normalizeWatchRange({ start: 1 }, 100), null);
    assert.equal(normalizeWatchRange({ start: 'a', end: 2 }, 100), null);
    assert.equal(normalizeWatchRange({ start: Number.NaN, end: 5 }, 100), null);
  });

  it('handles an unknown duration (0)', () => {
    assert.deepEqual(normalizeWatchRange({ start: 0, end: 10 }, 0), { start: 0, end: 10 });
  });
});

describe('detectPlayedSpan', () => {
  it('does not credit the first sample (no anchor yet)', () => {
    assert.equal(
      detectPlayedSpan({ prevPosition: null, position: 5, elapsedSeconds: 5, isPlaying: true }),
      null
    );
  });

  it('does not credit while paused', () => {
    assert.equal(
      detectPlayedSpan({ prevPosition: 0, position: 5, elapsedSeconds: 5, isPlaying: false }),
      null
    );
  });

  it('does not credit a rewind or a frozen position', () => {
    assert.equal(
      detectPlayedSpan({ prevPosition: 10, position: 5, elapsedSeconds: 5, isPlaying: true }),
      null
    );
    assert.equal(
      detectPlayedSpan({ prevPosition: 5, position: 5, elapsedSeconds: 5, isPlaying: true }),
      null
    );
  });

  it('credits normal 1x playback', () => {
    assert.deepEqual(
      detectPlayedSpan({ prevPosition: 0, position: 5, elapsedSeconds: 5, isPlaying: true }),
      { start: 0, end: 5 }
    );
  });

  it('credits up to 2x playback within the tolerance', () => {
    assert.deepEqual(
      detectPlayedSpan({ prevPosition: 0, position: 10, elapsedSeconds: 5, isPlaying: true }),
      { start: 0, end: 10 }
    );
  });

  it('rejects a forward seek larger than real elapsed playback', () => {
    // 50s jump in a 5s window: max advance is 5 * 2 + 2 = 12s.
    assert.equal(
      detectPlayedSpan({ prevPosition: 3545, position: 3595, elapsedSeconds: 5, isPlaying: true }),
      null
    );
  });

  it('does not credit the 60-minute video skip-to-minute-59 case', () => {
    // 3600s video; user is at 0 and jumps to 3540 (minute 59).
    assert.equal(
      detectPlayedSpan({ prevPosition: 0, position: 3540, elapsedSeconds: 5, isPlaying: true }),
      null
    );
  });

  it('credits exactly the max advance and rejects one second more', () => {
    const max = 5 * MAX_PLAYBACK_RATE + CLIENT_CONTINUOUS_TOLERANCE_SECONDS; // 12
    assert.deepEqual(
      detectPlayedSpan({ prevPosition: 0, position: max, elapsedSeconds: 5, isPlaying: true }),
      { start: 0, end: max }
    );
    assert.equal(
      detectPlayedSpan({ prevPosition: 0, position: max + 1, elapsedSeconds: 5, isPlaying: true }),
      null
    );
  });

  it('credits a small move even when the timer reports no elapsed time', () => {
    const max = CLIENT_CONTINUOUS_TOLERANCE_SECONDS; // 2
    assert.deepEqual(
      detectPlayedSpan({ prevPosition: 0, position: max, elapsedSeconds: 0, isPlaying: true }),
      { start: 0, end: max }
    );
    assert.equal(
      detectPlayedSpan({ prevPosition: 0, position: max + 1, elapsedSeconds: 0, isPlaying: true }),
      null
    );
  });

  it('tolerates a negative elapsed time (clock skew) as the minimum window', () => {
    assert.deepEqual(
      detectPlayedSpan({ prevPosition: 0, position: 1, elapsedSeconds: -5, isPlaying: true }),
      { start: 0, end: 1 }
    );
    assert.equal(
      detectPlayedSpan({ prevPosition: 0, position: 3, elapsedSeconds: -5, isPlaying: true }),
      null
    );
  });
});

describe('pendingSeconds', () => {
  it('sums buffered spans', () => {
    assert.equal(
      pendingSeconds([
        { start: 0, end: 5 },
        { start: 10, end: 20 },
      ]),
      15
    );
  });
});

describe('trimPendingWatchRanges', () => {
  it('returns the list unchanged when it is within the cap', () => {
    const ranges: WatchRange[] = [
      { start: 0, end: 5 },
      { start: 5, end: 10 },
    ];
    assert.deepEqual(trimPendingWatchRanges(ranges, 30), ranges);
  });

  it('drops oldest spans until the buffered seconds fit the cap', () => {
    // Seven 10s spans (2x over a 5s poll) total 70s while the cap is 30s.
    const ranges: WatchRange[] = Array.from({ length: 7 }, (_, i) => ({
      start: i * 10,
      end: (i + 1) * 10,
    }));
    const trimmed = trimPendingWatchRanges(ranges, 30);
    assert.ok(pendingSeconds(trimmed) <= 30);
    assert.deepEqual(trimmed, [
      { start: 40, end: 50 },
      { start: 50, end: 60 },
      { start: 60, end: 70 },
    ]);
  });

  it('keeps a single span even when it alone exceeds the cap', () => {
    assert.deepEqual(trimPendingWatchRanges([{ start: 0, end: 100 }], 30), [
      { start: 0, end: 100 },
    ]);
  });
});

describe('reconcileWatchProgress', () => {
  const DURATION = 3600; // 60-minute video

  it('rejects a one-shot claim of the whole video (skip to the end)', () => {
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: 3540 }], // "I watched up to minute 59"
      elapsedSeconds: 5,
    });
    assert.equal(result.accepted, false);
    assert.equal(result.watchedSeconds, 0);
    assert.equal(result.percent, 0);
    assert.deepEqual(result.ranges, []);
    assert.equal(result.addedSeconds, 3540);
  });

  it('rejects a first-sample claim larger than the minimum budget', () => {
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 3540, end: 3600 }], // only the final minute
      elapsedSeconds: null, // first sample -> SERVER_MIN_ELAPSED_SECONDS
    });
    assert.equal(result.accepted, false);
    assert.equal(result.watchedSeconds, 0);
  });

  it('accepts a genuine small first span', () => {
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: 5 }],
      elapsedSeconds: null,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 5);
    assert.deepEqual(result.ranges, [{ start: 0, end: 5 }]);
    assert.equal(result.percent, 0);
  });

  it('accumulates a sequence of small spans', () => {
    const first = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: 5 }],
      elapsedSeconds: 5,
    });
    const second = reconcileWatchProgress({
      storedRanges: first.ranges,
      storedWatchedSeconds: first.watchedSeconds,
      duration: DURATION,
      segments: [{ start: 5, end: 10 }],
      elapsedSeconds: 5,
    });
    assert.equal(second.accepted, true);
    assert.equal(second.watchedSeconds, 10);
    assert.deepEqual(second.ranges, [{ start: 0, end: 10 }]);
  });

  it('never double-counts re-watching the same span', () => {
    const result = reconcileWatchProgress({
      storedRanges: [{ start: 0, end: 60 }],
      storedWatchedSeconds: 60,
      duration: DURATION,
      segments: [{ start: 0, end: 60 }],
      elapsedSeconds: 60,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 60);
    assert.equal(result.addedSeconds, 0);
  });

  it('unions an overlapping span and counts only the new seconds', () => {
    const result = reconcileWatchProgress({
      storedRanges: [{ start: 0, end: 30 }],
      storedWatchedSeconds: 30,
      duration: DURATION,
      segments: [{ start: 10, end: 60 }],
      elapsedSeconds: 15,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 60);
    assert.equal(result.addedSeconds, 30);
    assert.deepEqual(result.ranges, [{ start: 0, end: 60 }]);
    assert.equal(result.percent, 1);
  });

  it('clamps a span to the video duration', () => {
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: 100,
      segments: [{ start: 0, end: 150 }],
      elapsedSeconds: 60,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 100);
    assert.equal(result.percent, 100);
    assert.deepEqual(result.ranges, [{ start: 0, end: 100 }]);
  });

  it('ignores malformed segments', () => {
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 'x', end: 5 }, null, { start: 0 }, 42],
      elapsedSeconds: 60,
    });
    assert.equal(result.watchedSeconds, 0);
    assert.equal(result.addedSeconds, 0);
    assert.deepEqual(result.ranges, []);
  });

  it('records nothing while the duration is unknown', () => {
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: 0,
      segments: [{ start: 0, end: 10 }],
      elapsedSeconds: null,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 0);
    assert.equal(result.percent, 0);
  });

  it('preserves backfilled legacy progress with no new segments', () => {
    const result = reconcileWatchProgress({
      storedRanges: [{ start: 0, end: 948 }],
      storedWatchedSeconds: 948,
      duration: 1200,
      segments: [],
      elapsedSeconds: 60,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 948);
    assert.equal(result.percent, 79);
  });

  it('caps the budget for a long idle gap (no unlimited credit on return)', () => {
    // Elapsed is capped at SERVER_MAX_ELAPSED_SECONDS (60); budget = 60 * 2.5.
    const cap = SERVER_MAX_ELAPSED_SECONDS * WATCH_BUDGET_RATE; // 150
    const atCap = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: cap }],
      elapsedSeconds: 100000,
    });
    assert.equal(atCap.accepted, true);
    assert.equal(atCap.watchedSeconds, cap);

    const overCap = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: cap + 1 }],
      elapsedSeconds: 100000,
    });
    assert.equal(overCap.accepted, false);
  });

  it('treats the added-seconds budget as inclusive at the boundary', () => {
    const budget = 4 * WATCH_BUDGET_RATE; // 10
    const atLimit = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: budget }],
      elapsedSeconds: 4,
    });
    assert.equal(atLimit.accepted, true);

    const overLimit = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: budget + 1 }],
      elapsedSeconds: 4,
    });
    assert.equal(overLimit.accepted, false);
  });

  it('leaves stored ranges untouched when a sample is rejected', () => {
    const stored: WatchRange[] = [{ start: 0, end: 10 }];
    const result = reconcileWatchProgress({
      storedRanges: stored,
      storedWatchedSeconds: 10,
      duration: DURATION,
      segments: [{ start: 0, end: 500 }],
      elapsedSeconds: 1,
    });
    assert.equal(result.accepted, false);
    assert.equal(result.watchedSeconds, 10);
    assert.equal(result.addedSeconds, 490);
    assert.deepEqual(result.ranges, [{ start: 0, end: 10 }]);
  });

  it('honours the stored watched-seconds floor and keeps ranges consistent', () => {
    // A legacy row whose watched_seconds floor outran its ranges: the floor is
    // represented as a span so an accepted sample cannot snap the total down.
    const result = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 100,
      duration: DURATION,
      segments: [],
      elapsedSeconds: 60,
    });
    assert.equal(result.accepted, true);
    assert.equal(result.watchedSeconds, 100);
    assert.equal(result.addedSeconds, 0);
    assert.deepEqual(result.ranges, [{ start: 0, end: 100 }]);
  });

  it('uses the first-sample floor when no previous sample exists', () => {
    const budget = SERVER_MIN_ELAPSED_SECONDS * WATCH_BUDGET_RATE; // 37.5
    const accepted = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: Math.floor(budget) }],
      elapsedSeconds: null,
    });
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.watchedSeconds, Math.floor(budget));

    const rejected = reconcileWatchProgress({
      storedRanges: [],
      storedWatchedSeconds: 0,
      duration: DURATION,
      segments: [{ start: 0, end: Math.floor(budget) + 1 }],
      elapsedSeconds: null,
    });
    assert.equal(rejected.accepted, false);
  });
});

describe('budget invariants', () => {
  it('keeps the client buffer cap within the server minimum budget', () => {
    // The trim cap must fit the first-sample budget, or a backlogged flush is
    // rejected forever and the watched seconds loop instead of being accepted.
    assert.ok(
      MAX_PENDING_WATCH_SECONDS <= SERVER_MIN_ELAPSED_SECONDS * WATCH_BUDGET_RATE,
      'MAX_PENDING_WATCH_SECONDS must not exceed the first-sample budget'
    );
  });
});
