import { avatarSvg } from '@/lib/avatar';

/** Caps how much arbitrary input reaches the generator on a public endpoint. */
const MAX_SEED_LENGTH = 64;

// Deterministic avatar image: /api/avatar/<seed>.
//
// Served from our own origin rather than inlined as a data URI, because a page
// listing 25 accounts would otherwise carry tens of KB of encoded SVG inside its
// HTML. The bytes depend only on the path segment, so the response is safe to
// cache immutably in the browser and at the CDN edge.
//
// Unauthenticated by design: the seed is a non-secret identifier (a user id) and
// the output is purely decorative artwork. The generated SVG contains no scripts,
// and the global X-Content-Type-Options: nosniff header (next.config.mjs)
// prevents it being reinterpreted as anything else.
export async function GET(_request: Request, { params }: { params: Promise<{ seed: string }> }) {
  const { seed } = await params;
  const trimmed = (seed ?? '').slice(0, MAX_SEED_LENGTH);

  if (!trimmed) {
    return new Response('Seed required', { status: 404 });
  }

  return new Response(avatarSvg(trimmed), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
