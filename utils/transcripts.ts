// Server-only TranscriptAPI client (https://transcriptapi.com/docs/api/).
// Caches every transcript in the `transcripts` table keyed by YouTube video ID
// so repeated assessment starts never re-bill the API (FR-D1). The API key
// lives only in server env (RULES §1.2) and each failure mode is a typed error
// the action layer maps to friendly copy (RULES §10.1).
//
// SERVER ONLY.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/utils/db/db';
import { transcriptsTable } from '@/utils/db/schema';

const API_BASE = 'https://transcriptapi.com/api/v2';
const REQUEST_TIMEOUT_MS = 15_000;
// Cap stored/LLM-bound transcript size (matches the old captions cap).
const MAX_TRANSCRIPT_CHARS = 40_000;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** TRANSCRIPTAPI_KEY missing/empty - config problem, not a user error. */
export class TranscriptNotConfiguredError extends Error {
  constructor() {
    super('TranscriptAPI is not configured (TRANSCRIPTAPI_KEY missing).');
    this.name = 'TranscriptNotConfiguredError';
  }
}

/** 404 or empty payload: the video does not exist or has no captions. */
export class TranscriptNotFoundError extends Error {
  constructor() {
    super('No transcript is available for this video.');
    this.name = 'TranscriptNotFoundError';
  }
}

/** 429 - upstream busy; user-facing copy says "try again in a moment". */
export class TranscriptRateLimitError extends Error {
  constructor() {
    super('TranscriptAPI rate limit reached.');
    this.name = 'TranscriptRateLimitError';
  }
}

/** Request exceeded REQUEST_TIMEOUT_MS - distinct copy from generic failure. */
export class TranscriptTimeoutError extends Error {
  constructor() {
    super('TranscriptAPI request timed out.');
    this.name = 'TranscriptTimeoutError';
  }
}

/** Everything else: invalid ID, 401/402/5xx, timeout, network, malformed body. */
export class TranscriptAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptAPIError';
  }
}

export type TranscriptResult = {
  transcript: string;
  language: string | null;
  /** True when the text came from the DB cache (no API credit spent). */
  cached: boolean;
};

/**
 * Fetch a video's transcript, cache-first: DB by video ID → TranscriptAPI →
 * cache write (best-effort, race-safe via ON CONFLICT DO NOTHING) → return.
 * Throws the typed errors above; never returns an empty transcript.
 */
export async function getTranscript(youtubeId: string): Promise<TranscriptResult> {
  if (!VIDEO_ID_PATTERN.test(youtubeId)) {
    throw new TranscriptAPIError(`Invalid YouTube video ID: ${youtubeId}`);
  }

  const cachedRows = await db
    .select()
    .from(transcriptsTable)
    .where(eq(transcriptsTable.youtube_id, youtubeId));
  const cached = cachedRows[0];
  if (cached) {
    return { transcript: cached.transcript, language: cached.language, cached: true };
  }

  const apiKey = process.env.TRANSCRIPTAPI_KEY;
  if (!apiKey) throw new TranscriptNotConfiguredError();

  const url = new URL(`${API_BASE}/youtube/transcript`);
  url.searchParams.set('video_url', youtubeId);
  // Plain concatenated text, no timestamps - the LLM only needs the prose.
  url.searchParams.set('format', 'text');
  url.searchParams.set('include_timestamp', 'false');

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    if (timedOut) throw new TranscriptTimeoutError();
    throw new TranscriptAPIError('TranscriptAPI unreachable');
  }

  if (res.status === 404) throw new TranscriptNotFoundError();
  if (res.status === 429) throw new TranscriptRateLimitError();
  if (!res.ok) throw new TranscriptAPIError(`TranscriptAPI responded ${res.status}`);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new TranscriptAPIError('TranscriptAPI returned a malformed JSON body');
  }
  const data = body as { transcript?: unknown; language?: unknown };
  if (typeof data.transcript !== 'string') throw new TranscriptNotFoundError();

  const transcript = data.transcript
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TRANSCRIPT_CHARS);
  if (transcript.length === 0) throw new TranscriptNotFoundError();
  const language = typeof data.language === 'string' ? data.language : null;

  // Best-effort cache write: a duplicate-key race just means another request
  // stored it first - either way the next start is served from the DB.
  try {
    await db
      .insert(transcriptsTable)
      .values({
        id: randomUUID(),
        youtube_id: youtubeId,
        transcript,
        language,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error(
      '[transcripts] cache write failed:',
      err instanceof Error ? err.message : 'unknown'
    );
  }

  return { transcript, language, cached: false };
}
