// Per-IP token-bucket rate limit for the claim POST routes.
//
// Why it lives here: the Tier-2 endpoint-challenge flow makes Foxbook
// issue an outbound fetch to a claimant-supplied URL (vetted by the
// adapter's SSRF guard, but still a network egress the caller triggers
// for free). Combined with the unauthenticated claim surface, that lets
// one client drive repeated outbound requests / claim churn. A coarse
// per-IP bucket blunts the amplification and ordinary abuse.
//
// Scope caveat: this is in-memory and therefore PER INSTANCE. With N
// api machines the effective ceiling is N×capacity. It's a safety valve,
// not a global quota — a distributed limiter (Redis/Neon) would be a
// separate, heavier change. Documented here so the next reader doesn't
// mistake it for an authoritative quota.

import type { Context, Next } from "hono";

export type TokenBucketOptions = {
  /** Max tokens (and burst size) per IP. */
  capacity: number;
  /** Tokens added per second, capped at `capacity`. */
  refillPerSec: number;
  /** Clock injection seam (ms epoch). Defaults to Date.now. */
  now?: () => number;
};

export type TakeResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export type TokenBucketLimiter = {
  /** Consume one token for `key`; report whether it was allowed. */
  take: (key: string) => TakeResult;
};

type Bucket = { tokens: number; updatedAt: number };

/**
 * In-memory token-bucket limiter keyed by an arbitrary string (here the
 * client IP). Lazily refills on each `take` from the elapsed time, so
 * there's no background timer and idle buckets cost nothing until next
 * touched.
 */
export function createTokenBucketLimiter(opts: TokenBucketOptions): TokenBucketLimiter {
  const now = opts.now ?? Date.now;
  const { capacity, refillPerSec } = opts;
  const buckets = new Map<string, Bucket>();

  return {
    take(key: string): TakeResult {
      const t = now();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: capacity, updatedAt: t };
        buckets.set(key, bucket);
      } else {
        const elapsedSec = Math.max(0, (t - bucket.updatedAt) / 1000);
        bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
        bucket.updatedAt = t;
      }

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return { allowed: true };
      }

      // How long until one whole token is available again.
      const deficit = 1 - bucket.tokens;
      const retryAfterSec = refillPerSec > 0 ? Math.max(1, Math.ceil(deficit / refillPerSec)) : 60;
      return { allowed: false, retryAfterSec };
    },
  };
}

/**
 * Extract the client IP for rate-limit keying. The api runs behind Fly,
 * which sets `Fly-Client-IP`; we fall back to the first hop of
 * `X-Forwarded-For`, then to a constant bucket so a missing header can't
 * silently disable the limit (everyone shares one bucket — fail-closed-ish
 * rather than unlimited).
 */
export function clientIpFor(c: Context): string {
  const fly = c.req.header("Fly-Client-IP");
  if (fly && fly.length > 0) return fly;
  const xff = c.req.header("X-Forwarded-For");
  if (xff && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length > 0) return first;
  }
  return "unknown";
}

/** Default production limits: 30 claim POSTs per IP per burst, refilling
 *  at 0.5/sec (~1 every 2s). Generous for a human walking a claim
 *  through the flow; tight enough to blunt scripted amplification. */
export const DEFAULT_CLAIM_RATE_LIMIT: TokenBucketOptions = {
  capacity: 30,
  refillPerSec: 0.5,
};

/**
 * Hono middleware that applies `limiter` per client IP and returns 429 +
 * Retry-After when the bucket is empty.
 */
export function rateLimitMiddleware(limiter: TokenBucketLimiter) {
  return async (c: Context, next: Next) => {
    const result = limiter.take(clientIpFor(c));
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSec));
      return c.json({ error: "rate-limited", retry_after_seconds: result.retryAfterSec }, 429);
    }
    await next();
    return undefined;
  };
}
