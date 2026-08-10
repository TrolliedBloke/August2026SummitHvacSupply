/**
 * Fixed-window rate limiter for public mutation endpoints.
 *
 * Deliberately NOT marked `server-only`: that specifier is aliased by Next at
 * build time and does not resolve in the unit test runner, and this module is a
 * security control that should be directly testable. It holds no secrets --
 * only request counters -- and is imported solely by route handlers. The
 * `server-only` guard stays on the modules that do hold secrets (email,
 * supabase, order-token).
 *
 * SCOPE AND LIMITS -- read before relying on this.
 *
 * State lives in the process, so the effective limit is (limit x number of
 * running instances). On a single long-lived server that is a real control; on
 * a horizontally scaled or serverless deployment it degrades to a coarse one,
 * because each instance keeps its own counter and cold starts reset it.
 *
 * It is deliberately still here: before this, public endpoints that send email
 * and write rows had no limit whatsoever, and an in-process bound is a large
 * improvement over none. Replacing the Map with Redis, Upstash or a Postgres
 * table makes it distributed without changing any call site.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Bound memory: a flood of unique keys must not grow the map without limit. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [existingKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(existingKey);
    }
    // Still oversized after pruning expired entries: drop everything rather
    // than leak. Worst case is a brief window where limits reset early.
    if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/**
 * Best-effort client identity for rate limiting. Proxy headers are spoofable,
 * so this is a throttle on casual abuse, not an authentication signal, and it
 * must never be used to make an authorization decision.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
