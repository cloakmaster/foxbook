// Per-IP rate limit for the claim POST routes. The endpoint-challenge
// flow makes Foxbook fetch a claimant-supplied URL, so an unauthenticated
// caller can use /claim/start-domain + /claim/verify-endpoint as an
// outbound-request amplifier. The token bucket blunts that (and ordinary
// abuse) per client IP. It's per-instance (in-memory) by design — a
// coarse safety valve, not a distributed quota.

import { describe, expect, it } from "vitest";

import type { ClaimDeps } from "../src/claim/handlers.js";
import { createTokenBucketLimiter } from "../src/claim/rate-limit.js";
import { claimRoute } from "../src/claim/route.js";

// Minimal deps that let /claim/start succeed without a DB; the
// rate-limit tests only care about the 201-vs-429 boundary.
function stubClaimDeps(): ClaimDeps {
  return {
    claimRepo: {
      insertClaim: async () => ({ ok: true, id: "claim-1" }),
      findById: async () => ({
        id: "claim-1",
        agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        state: "gist_pending",
        assetType: "github_handle",
        assetValue: "alice",
        ed25519PublicKeyHex: "a".repeat(64),
        recoveryKeyFingerprint: `sha256:${"c".repeat(64)}`,
        verificationCode: "X".repeat(32),
        startedAt: new Date("2026-04-27T08:00:00Z"),
        completedAt: null,
      }),
      markTier2Verified: async () => {},
      findByAsset: async () => null,
      findLatestLeafIndexForDid: async () => null,
    },
    gist: { verifyGistContainsCode: async () => ({ status: "error" }) },
    dns: {
      verifyDnsTxtContainsCode: async () => {
        throw new Error("not called");
      },
    },
    endpoint: {
      verifyEndpointSignedNonce: async () => {
        throw new Error("not called");
      },
    },
    verificationCommitter: async () => {
      throw new Error("not called");
    },
    revocationCommitter: async () => {
      throw new Error("not called");
    },
  };
}

const START_BODY = JSON.stringify({
  asset_type: "github_handle",
  asset_value: "alice",
  ed25519_public_key_hex: "a".repeat(64),
  recovery_key_fingerprint: `sha256:${"c".repeat(64)}`,
});

function startReq(ip: string): Request {
  return new Request("http://local/claim/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Fly-Client-IP": ip },
    body: START_BODY,
  });
}

describe("createTokenBucketLimiter — token bucket math", () => {
  it("allows up to `capacity` requests then blocks", () => {
    const now = 1_000_000;
    const limiter = createTokenBucketLimiter({
      capacity: 3,
      refillPerSec: 0, // no refill within the test window
      now: () => now,
    });
    expect(limiter.take("1.2.3.4").allowed).toBe(true);
    expect(limiter.take("1.2.3.4").allowed).toBe(true);
    expect(limiter.take("1.2.3.4").allowed).toBe(true);
    const blocked = limiter.take("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks buckets independently per IP", () => {
    const now = 1_000_000;
    const limiter = createTokenBucketLimiter({ capacity: 1, refillPerSec: 0, now: () => now });
    expect(limiter.take("10.0.0.1").allowed).toBe(true);
    expect(limiter.take("10.0.0.1").allowed).toBe(false);
    // A different IP has its own full bucket.
    expect(limiter.take("10.0.0.2").allowed).toBe(true);
  });

  it("refills over time and lets a blocked IP through again", () => {
    let now = 1_000_000;
    const limiter = createTokenBucketLimiter({
      capacity: 2,
      refillPerSec: 1, // one token per second
      now: () => now,
    });
    expect(limiter.take("9.9.9.9").allowed).toBe(true);
    expect(limiter.take("9.9.9.9").allowed).toBe(true);
    expect(limiter.take("9.9.9.9").allowed).toBe(false);
    // 1.5s later → one token refilled.
    now += 1500;
    expect(limiter.take("9.9.9.9").allowed).toBe(true);
    // ...and immediately empty again.
    expect(limiter.take("9.9.9.9").allowed).toBe(false);
  });

  it("never refills above capacity", () => {
    let now = 1_000_000;
    const limiter = createTokenBucketLimiter({ capacity: 2, refillPerSec: 100, now: () => now });
    now += 10_000; // huge idle gap
    expect(limiter.take("5.5.5.5").allowed).toBe(true);
    expect(limiter.take("5.5.5.5").allowed).toBe(true);
    expect(limiter.take("5.5.5.5").allowed).toBe(false);
  });
});

describe("claimRoute — per-IP rate limit on POST /claim/start", () => {
  it("returns 429 + Retry-After once the bucket is empty for that IP", async () => {
    const limiter = createTokenBucketLimiter({ capacity: 2, refillPerSec: 0 });
    const app = claimRoute(stubClaimDeps(), { rateLimiter: limiter });

    const r1 = await app.request(startReq("1.1.1.1"));
    const r2 = await app.request(startReq("1.1.1.1"));
    const r3 = await app.request(startReq("1.1.1.1"));

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r3.status).toBe(429);
    expect(Number(r3.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = (await r3.json()) as { error: string };
    expect(body.error).toBe("rate-limited");
  });

  it("keys per IP — a second IP is not penalised by the first", async () => {
    const limiter = createTokenBucketLimiter({ capacity: 1, refillPerSec: 0 });
    const app = claimRoute(stubClaimDeps(), { rateLimiter: limiter });

    expect((await app.request(startReq("2.2.2.2"))).status).toBe(201);
    expect((await app.request(startReq("2.2.2.2"))).status).toBe(429);
    // Fresh IP → fresh bucket.
    expect((await app.request(startReq("3.3.3.3"))).status).toBe(201);
  });

  it("does not rate-limit the read-only GET /claim/by-handle", async () => {
    const limiter = createTokenBucketLimiter({ capacity: 1, refillPerSec: 0 });
    const app = claimRoute(stubClaimDeps(), { rateLimiter: limiter });
    const get = (): Request =>
      new Request("http://local/claim/by-handle/github_handle/alice", {
        headers: { "Fly-Client-IP": "4.4.4.4" },
      });
    // Many GETs from the same IP — none should 429.
    for (let i = 0; i < 5; i++) {
      const res = await app.request(get());
      expect(res.status).not.toBe(429);
    }
  });
});
