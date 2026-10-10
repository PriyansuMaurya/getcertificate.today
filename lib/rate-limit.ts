// Best-effort, dependency-free rate limiter (defence in depth).
//
// Counters live in this module's Map, so they are shared by every request
// handled by one running server instance and NOT across instances. On a
// multi-instance / serverless deployment this is a coarse brake, not a hard
// guarantee - edge or proxy rate limiting remains the real control. It is
// deliberately permissive enough that normal use (and the E2E scripts) never
// trips it; each caller picks a window and limit suited to the endpoint.
//
// Deliberately NOT a 'use server' module: these exports are internal helpers,
// never publicly callable endpoints (same rule as lib/safe-next.ts).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Keep the Map from growing without bound: once it is large, drop expired
// buckets. Cheap, and only runs occasionally.
const PRUNE_THRESHOLD = 10_000;

function prune(now: number): void {
  if (buckets.size < PRUNE_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Whole seconds until the current window resets (0 when allowed). */
  retryAfterSeconds: number;
};

/**
 * Fixed-window counter. The first call in a window starts it; calls beyond the
 * limit are rejected until the window resets. Key should combine the endpoint
 * and a client identifier (ip, email, or user id).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Coarse client identifier from proxy headers, for keying a limit. Falls back
 * to 'unknown' so a missing header still shares one bucket rather than silently
 * bypassing the check. The value is only ever used as a Map key.
 */
export function clientKeyFromHeaders(get: (name: string) => string | null): string {
  const forwardedFor = get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]!.trim();
  return get('x-real-ip') ?? 'unknown';
}
