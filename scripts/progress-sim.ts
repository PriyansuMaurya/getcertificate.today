/**
 * TEMP scratch: faithful simulation of the video progress pipeline.
 *
 * Models, on a fake clock:
 *   YouTubePlayer sampling (5s ticks, seek detection, hidden-tab anchor drop)
 *   LearnPlayer buffering + 15s flush gate + pagehide/visibilitychange flush
 *   saveProgress server action (row lock, wall-clock budget, monotonic floors)
 *
 * and reports how much honest watching actually lands in the database.
 */
import {
  MAX_PENDING_WATCH_SECONDS,
  PLAYER_SAMPLE_INTERVAL_MS,
  PROGRESS_FLUSH_INTERVAL_MS,
  detectPlayedSpan,
  mergeWatchRanges,
  reconcileWatchProgress,
  totalWatchedSeconds,
  trimPendingWatchRanges,
  watchPercent,
  type WatchRange,
} from '../utils/watch-progress';

const TICK = PLAYER_SAMPLE_INTERVAL_MS;

type Phase =
  | { kind: 'watch'; seconds: number; rate?: number }
  | { kind: 'pause'; seconds: number }
  | { kind: 'hide'; seconds: number }
  | { kind: 'seek'; seconds: number }
  | { kind: 'reload' };

type Row = {
  watchedSeconds: number;
  ranges: WatchRange[];
  lastWatchedAt: number | null;
  percent: number;
  duration: number;
};

type Options = {
  duration: number;
  phases: Phase[];
  latencyMs?: number;
  tickDriftMs?: number;
  netFailRate?: number;
  label: string;
};

type Report = {
  label: string;
  worldSeconds: number;
  expectedSeconds: number;
  serverSeconds: number;
  lossSeconds: number;
  efficiency: number;
  flushes: number;
  accepted: number;
  rejected: number;
  retried: number;
  maxPendingSeen: number;
  droppedByTrim: number;
  percentDecreases: number;
  finalPercent: number;
  dbWriteSeconds: number;
};

/** Fraction of ticks whose wall-clock gap is credited (models the ideal). */
function simulate(options: Options): Report {
  const { duration, phases, latencyMs = 0, tickDriftMs = 0, netFailRate = 0, label } = options;

  // ---------------- server ----------------
  const row: Row = {
    watchedSeconds: 0,
    ranges: [],
    lastWatchedAt: null,
    percent: 0,
    duration: 0,
  };
  let dbWrites = 0;
  let network = 0;

  // Every request advances the server clock, accepted or not.
  const serverApply = (segments: WatchRange[], now: number): 'accepted' | 'retryable' | 'error' => {
    const elapsed = row.lastWatchedAt === null ? null : (now - row.lastWatchedAt) / 1000;
    network += 1;
    if (netFailRate > 0 && network % Math.max(2, Math.round(1 / netFailRate)) === 0) {
      return 'error'; // network failure: client retries
    }
    const outcome = reconcileWatchProgress({
      storedRanges: row.ranges,
      storedWatchedSeconds: row.watchedSeconds,
      duration,
      segments,
      elapsedSeconds: elapsed,
    });
    row.lastWatchedAt = now;
    row.duration = Math.max(row.duration, duration);
    dbWrites += 1;
    if (outcome.accepted) {
      row.watchedSeconds = outcome.watchedSeconds;
      row.ranges = outcome.ranges;
      row.percent = Math.max(row.percent, outcome.percent);
      return 'accepted';
    }
    return 'retryable';
  };

  // ---------------- client ----------------
  let pending: WatchRange[] = [];
  let inFlight = false;
  let lastFlushAt = 0;
  let inflightSegments: WatchRange[] | null = null;
  let inflightResolveAt = 0;

  let lastPosition: number | null = null;
  let lastTickAt = 0;
  let position = 0;

  // ground truth: seconds of content a perfect implementation would credit
  let expected: WatchRange[] = [];

  let flushes = 0;
  let accepted = 0;
  let rejected = 0;
  let retried = 0;
  let maxPending = 0;
  let droppedByTrim = 0;
  let percentDecreases = 0;
  let lastPercent = 0;
  let worldTime = 0;

  function handleSample(durationNow: number, pos: number, watched: WatchRange | null) {
    if (watched) {
      const before = pendingSeconds(pending) + (watched.end - watched.start);
      pending = trimPendingWatchRanges([...pending, watched], MAX_PENDING_WATCH_SECONDS);
      const after = pendingSeconds(pending);
      if (after < before) droppedByTrim += before - after;
      maxPending = Math.max(maxPending, after);
    }
    if (inFlight || pending.length === 0) return;
    if (worldTime - lastFlushAt < PROGRESS_FLUSH_INTERVAL_MS) return;
    doFlush(pos);
    void durationNow;
  }

  function doFlush(pos: number) {
    if (pending.length === 0 || inFlight) return;
    const segments = pending;
    pending = [];
    inFlight = true;
    lastFlushAt = worldTime;
    inflightSegments = segments;
    inflightResolveAt = worldTime + latencyMs;
    flushes += 1;
    void pos;
  }

  function settleInflight() {
    if (inflightSegments === null || worldTime < inflightResolveAt) return;
    const segments = inflightSegments;
    inflightSegments = null;
    inFlight = false;
    const result = serverApply(segments, worldTime);
    if (result === 'accepted') {
      accepted += 1;
      if (row.percent < lastPercent) percentDecreases += 1;
      lastPercent = row.percent;
    } else {
      rejected += 1;
      if (result === 'retryable') retried += 1;
      // Over budget or network error: keep the spans at the front and retry.
      pending = segments.concat(pending);
      maxPending = Math.max(maxPending, pendingSeconds(pending));
    }
  }

  // ---------------- run the timeline ----------------
  for (const phase of phases) {
    if (phase.kind === 'reload') {
      // pagehide best-effort flush, then client state resets.
      doFlush(position);
      settleInflight();
      pending = [];
      inFlight = false;
      inflightSegments = null;
      lastFlushAt = worldTime;
      lastPosition = null;
      lastTickAt = worldTime;
      continue;
    }

    if (phase.kind === 'seek') {
      position = Math.max(0, Math.min(duration, position + phase.seconds));
      lastPosition = position;
      lastTickAt = worldTime;
      continue;
    }

    const end = worldTime + phase.seconds * 1000;
    const hidden = phase.kind === 'hide';
    if (hidden) {
      // visibilitychange -> immediate flush (no 15s gate), then no ticks.
      doFlush(position);
      lastPosition = null;
      while (worldTime < end) {
        worldTime = Math.min(worldTime + TICK, end);
        position += TICK / 1000; // the video keeps playing while hidden
        settleInflight();
      }
      lastTickAt = worldTime;
      continue;
    }

    const playing = phase.kind === 'watch';
    const rate = phase.kind === 'watch' ? (phase.rate ?? 1) : 0;
    let tick = worldTime + TICK + tickDriftMs;
    while (worldTime < end) {
      worldTime = Math.min(tick, end);
      if (worldTime < end) worldTime = Math.min(tick, end);
      tick += TICK + tickDriftMs;

      const elapsedSeconds = Math.max(0, (worldTime - lastTickAt) / 1000);
      const prev = position;
      if (playing) position += elapsedSeconds * rate;
      if (position > duration) position = duration;

      // perfect credit reference (only for visible playing time)
      if (playing && prev > 0 && position > prev) {
        expected = mergeWatchRanges([...expected, { start: prev, end: position }]);
      } else if (playing && prev === 0 && position > 0) {
        expected = mergeWatchRanges([...expected, { start: 0, end: position }]);
      }

      const watched = detectPlayedSpan({
        prevPosition: lastPosition,
        position,
        elapsedSeconds,
        isPlaying: playing,
      });
      lastPosition = position;
      lastTickAt = worldTime;
      handleSample(duration, position, watched);
      settleInflight();

      if (worldTime >= end) break;
    }
    lastFlushAt = Math.max(lastFlushAt, 0);
  }

  // final flush on unload
  doFlush(position);
  while (inflightSegments !== null) {
    worldTime += Math.max(1, latencyMs);
    settleInflight();
  }

  const expectedSeconds = totalWatchedSeconds(expected);
  const serverSeconds = row.watchedSeconds;
  return {
    label,
    worldSeconds: Math.round(worldTime / 1000),
    expectedSeconds,
    serverSeconds,
    lossSeconds: Math.max(0, expectedSeconds - serverSeconds),
    efficiency: expectedSeconds > 0 ? serverSeconds / expectedSeconds : 1,
    flushes,
    accepted,
    rejected,
    retried,
    maxPendingSeen: maxPending,
    droppedByTrim,
    percentDecreases,
    finalPercent: row.percent,
    dbWriteSeconds: dbWrites,
  };
}

function pendingSeconds(ranges: WatchRange[]): number {
  return ranges.reduce((sum, r) => sum + Math.max(0, r.end - r.start), 0);
}

function show(report: Report) {
  console.log(
    [
      report.label.padEnd(38),
      `exp=${String(report.expectedSeconds).padStart(4)}s`,
      `db=${String(report.serverSeconds).padStart(4)}s`,
      `loss=${String(Math.round(report.lossSeconds)).padStart(4)}s`,
      `eff=${(report.efficiency * 100).toFixed(1).padStart(5)}%`,
      `flush=${String(report.flushes).padStart(3)}`,
      `acc=${String(report.accepted).padStart(3)}`,
      `rej=${String(report.rejected).padStart(3)}`,
      `trimLoss=${String(Math.round(report.droppedByTrim)).padStart(4)}s`,
      `maxPend=${report.maxPendingSeen}s`,
      `pctDown=${report.percentDecreases}`,
    ].join(' ')
  );
}

const HOUR = 3600;
const watch = (seconds: number, rate = 1): Phase => ({ kind: 'watch', seconds, rate });

const cases: Options[] = [
  {
    label: '1x clean 180s',
    duration: HOUR,
    phases: [watch(180)],
  },
  {
    label: '1x clean 600s',
    duration: HOUR,
    phases: [watch(600)],
  },
  {
    label: '1x drift300 600s',
    duration: HOUR,
    phases: [watch(600)],
    tickDriftMs: 300,
  },
  {
    label: '1x latency1200 600s',
    duration: HOUR,
    phases: [watch(600)],
    latencyMs: 1200,
  },
  {
    label: '2x clean 300s',
    duration: HOUR,
    phases: [watch(300, 2)],
  },
  {
    label: '2x drift300 300s',
    duration: HOUR,
    phases: [watch(300, 2)],
    tickDriftMs: 300,
  },
  {
    label: '2x latency600 300s',
    duration: HOUR,
    phases: [watch(300, 2)],
    latencyMs: 600,
  },
  {
    label: '1x 600s with 3x hide20',
    duration: HOUR,
    phases: [
      watch(200),
      { kind: 'hide', seconds: 20 },
      watch(200),
      { kind: 'hide', seconds: 20 },
      watch(200),
      { kind: 'hide', seconds: 20 },
    ],
  },
  {
    label: '1x 600s with reload at 300',
    duration: HOUR,
    phases: [watch(300), { kind: 'reload' }, watch(300)],
  },
  {
    label: '1x 600s 10 seeks fwd',
    duration: HOUR,
    phases: [
      watch(60),
      { kind: 'seek', seconds: 30 },
      watch(60),
      { kind: 'seek', seconds: 30 },
      watch(60),
      { kind: 'seek', seconds: 30 },
      watch(60),
    ],
  },
  {
    label: '1x 600s 5 pauses',
    duration: HOUR,
    phases: [
      watch(120),
      { kind: 'pause', seconds: 30 },
      watch(120),
      { kind: 'pause', seconds: 30 },
      watch(120),
    ],
  },
  {
    label: '1x netfail 600s',
    duration: HOUR,
    phases: [watch(600)],
    netFailRate: 0.3,
  },
  {
    label: 'short video 150s watched fully',
    duration: 150,
    phases: [watch(150)],
  },
  {
    label: 'short video 150s, 3min wall',
    duration: 150,
    phases: [watch(180)],
  },
];

console.log('=== pipeline credit retention (expected = honest visible watching) ===');
for (const c of cases) show(simulate(c));
