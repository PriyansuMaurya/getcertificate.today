// Server-side YouTube helpers (FR-C1 URL validation, FR-D1 content grounding).
// Caption fetch is best-effort: publicly served caption tracks only, falling
// back to oEmbed metadata when unavailable (PRD §14.2 - ToS review still open).

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeVideoMeta = {
  youtubeId: string;
  sourceUrl: string;
  title: string | null;
  author: string | null;
  transcript: string | null;
};

/**
 * Extract a video ID from common YouTube URL shapes.
 * Accepts youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, m.youtube.com,
 * with or without extra query params. Returns null for anything else.
 */
export function parseYouTubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID_PATTERN.test(v)) return v;

    const pathMatch = url.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    if (pathMatch) return pathMatch[2];
  }

  return null;
}

/**
 * Fetch title/channel via YouTube oEmbed (public, no API key required).
 * Returns nulls on any failure - callers treat metadata as optional.
 */
async function fetchOEmbed(
  youtubeId: string
): Promise<{ title: string | null; author: string | null }> {
  const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return { title: null, author: null };
    const data = (await res.json()) as { title?: string; author_name?: string };
    return { title: data.title ?? null, author: data.author_name ?? null };
  } catch {
    return { title: null, author: null };
  }
}

/**
 * Best-effort caption fetch: try the public timedtext endpoint for English
 * tracks (manual then auto-generated). Returns null when no track is served
 * or the payload is empty - never throws. (ToS review tracked in MEMORY.md.)
 */
async function fetchCaptions(youtubeId: string): Promise<string | null> {
  const attempts = [
    `https://www.youtube.com/api/timedtext?v=${youtubeId}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${youtubeId}&lang=en&kind=asr&fmt=json3`,
  ];

  for (const endpoint of attempts) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        events?: { segs?: { utf8?: string }[] }[];
      };
      const text = (data.events ?? [])
        .flatMap((e) => e.segs ?? [])
        .map((s) => s.utf8 ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 0) return text.slice(0, 40000);
    } catch {
      // try the next track shape
    }
  }
  return null;
}

/**
 * Gather everything assessment generation needs about a video:
 * metadata (always attempted) + transcript (best effort).
 */
export async function getVideoMeta(youtubeId: string): Promise<YouTubeVideoMeta> {
  const [meta, transcript] = await Promise.all([fetchOEmbed(youtubeId), fetchCaptions(youtubeId)]);
  return {
    youtubeId,
    sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
    title: meta.title,
    author: meta.author,
    transcript,
  };
}
