import type { EventEmitter } from "node:events";

import type { MerkleRepository } from "@foxbook/db";
import { Hono } from "hono";

import type { ClaimDeps } from "./claim/handlers.js";
import { claimRoute } from "./claim/route.js";
import { discoverRoute } from "./discover/route.js";
import type { DiscoveryRepository } from "./discover/types.js";
import { firehoseRoute } from "./firehose/route.js";

const STARTED_AT_MS = Date.now();

/** Default ceiling for the /healthz DB read. Well under Fly's 5s check
 *  timeout and external monitors' 10s, so a suspended/unreachable database
 *  surfaces as a fast 503 instead of hanging the health check. */
const DEFAULT_HEALTHZ_DB_TIMEOUT_MS = 3000;

/** Reject if `promise` doesn't settle within `ms`. Bounds the /healthz DB
 *  read: a suspended Neon compute leaves getRoot() pending forever, which
 *  (unbounded) hung the health check until the caller's socket timed out —
 *  the failure mode behind the May 2026 silent outage. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export type AppDeps = {
  discoveryRepo: DiscoveryRepository;
  claim: ClaimDeps;
  /** Firehose listener emitter. Tests inject a hand-rolled EventEmitter. */
  firehoseEmitter: EventEmitter;
  /** Merkle repo (read-only path) for /healthz leafCount. Optional —
   *  tests omit; production main.ts wires it. */
  merkleRepo?: MerkleRepository | undefined;
  /** Max time (ms) to wait for the /healthz DB read before returning a 503.
   *  Defaults to DEFAULT_HEALTHZ_DB_TIMEOUT_MS. Bounded so a suspended or
   *  unreachable database fails fast instead of hanging the health check. */
  healthzDbTimeoutMs?: number | undefined;
  /** Log-signing public key (hex) for /.well-known/foxbook.json.
   *  Optional — when undefined, the well-known surface omits the
   *  log_signing_public_key_hex field. */
  logSigningPublicKeyHex?: string | undefined;
};

/** Build the Hono app with injected deps. Used by main.ts and by tests. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  // Legacy simple health endpoint. /healthz is the rich shape used by
  // Fly's HTTP checks and external monitors.
  app.get("/health", (c) => c.json({ ok: true, service: "foxbook-api" }));

  app.get("/healthz", async (c) => {
    const uptime_seconds = Math.floor((Date.now() - STARTED_AT_MS) / 1000);
    if (!deps.merkleRepo) {
      return c.json({ status: "ok", service: "foxbook-api", leafCount: 0, uptime_seconds });
    }
    try {
      const root = await withTimeout(
        deps.merkleRepo.getRoot(),
        deps.healthzDbTimeoutMs ?? DEFAULT_HEALTHZ_DB_TIMEOUT_MS,
        "healthz getRoot",
      );
      const leafCount = root?.leafCount ?? 0;
      return c.json({ status: "ok", service: "foxbook-api", leafCount, uptime_seconds });
    } catch {
      // DB error OR a hung/suspended DB (timeout) → 503 + status:degraded.
      // Surfaces a clear "down" signal to external monitors fast, instead of
      // silently reporting healthy or hanging until the caller times out.
      return c.json(
        { status: "degraded", service: "foxbook-api", leafCount: 0, uptime_seconds },
        503,
      );
    }
  });

  // Service-discovery surface for future scouts. Stable shape that
  // re-implementations can $ref. supported_tiers stays at [1] until
  // the first end-to-end domain claim succeeds.
  app.get("/.well-known/foxbook.json", (c) => {
    c.header("Cache-Control", "public, max-age=300");
    return c.json({
      protocol_version: "1.0",
      supported_tiers: [1],
      transparency_log_url: "https://transparency.foxbook.dev",
      api_base: "https://api.foxbook.dev",
      ...(deps.logSigningPublicKeyHex && {
        log_signing_public_key_hex: deps.logSigningPublicKeyHex,
      }),
    });
  });

  const v1 = new Hono();
  v1.route("/", discoverRoute(deps.discoveryRepo));
  v1.route("/", claimRoute(deps.claim));
  app.route("/api/v1", v1);

  // /firehose lives at the root path (NOT under /api/v1) — it's a
  // long-lived SSE stream, semantically different from the request/
  // response /api/v1 surface.
  app.route("/", firehoseRoute({ emitter: deps.firehoseEmitter }));

  return app;
}
