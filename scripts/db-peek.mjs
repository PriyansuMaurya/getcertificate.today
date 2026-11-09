// TEMP scratch: read-only inspection of real learning_items progress rows.
import { config } from 'dotenv';
config({ path: '.env.local' });
const { default: postgres } = await import('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const totals = await sql`
  SELECT count(*)::int AS rows,
         count(*) FILTER (WHERE progress_percent > 0)::int AS touched,
         count(*) FILTER (WHERE progress_percent >= 100)::int AS done,
         count(*) FILTER (WHERE duration_seconds = 0)::int AS no_duration,
         count(*) FILTER (WHERE watched_seconds = 0 AND progress_percent > 0)::int AS pct_but_no_watch
  FROM learning_items`;
console.log('totals:', totals[0]);

const rows = await sql`
  SELECT
    substr(id, 1, 8) AS id,
    duration_seconds AS dur,
    position_seconds AS pos,
    watched_seconds AS watched,
    progress_percent AS pct,
    jsonb_array_length(watched_ranges) AS spans,
    length(watched_ranges::text) AS ranges_bytes,
    to_char(last_watched_at, 'MM-DD HH24:MI') AS last,
    (EXTRACT(EPOCH FROM (now() - last_watched_at)))::int AS secs_ago
  FROM learning_items
  WHERE progress_percent > 0 OR watched_seconds > 0
  ORDER BY last_watched_at DESC NULLS LAST
  LIMIT 30`;
console.log('rows:');
for (const r of rows) {
  const watchedPct = r.dur > 0 ? Math.floor((Number(r.watched) / Number(r.dur)) * 100) : 0;
  console.log(
    [
      String(r.id).padEnd(9),
      `dur=${String(r.dur).padStart(5)}`,
      `pos=${String(r.pos).padStart(5)}`,
      `watched=${String(r.watched).padStart(5)}`,
      `pct=${String(r.pct).padStart(3)}`,
      `pctFromWatched=${String(watchedPct).padStart(3)}`,
      `spans=${String(r.spans).padStart(4)}`,
      `rangesBytes=${String(r.ranges_bytes).padStart(5)}`,
      `last=${r.last ?? 'never'}`,
      `ago=${r.secs_ago === null ? '-' : r.secs_ago + 's'}`,
    ].join(' ')
  );
}

const mismatch = await sql`
  SELECT count(*)::int AS n
  FROM learning_items
  WHERE duration_seconds > 0
    AND progress_percent > 1 + floor(watched_seconds * 100.0 / duration_seconds)`;
console.log('rows where pct exceeds watched-derived pct:', mismatch[0].n);

const worst = await sql`
  SELECT substr(id,1,8) AS id, duration_seconds AS dur, watched_seconds AS watched,
         progress_percent AS pct, position_seconds AS pos
  FROM learning_items
  WHERE duration_seconds > 0
  ORDER BY (progress_percent - floor(watched_seconds * 100.0 / duration_seconds)) DESC
  LIMIT 5`;
console.log('largest pct-vs-watched divergence:');
for (const r of worst) console.log(' ', r);

await sql.end();
