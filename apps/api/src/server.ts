import type { EventEmitter } from "node:events";

import { Hono } from "hono";

import type { ClaimDeps } from "./claim/handlers.js";
import { claimRoute } from "./claim/route.js";
import { discoverRoute } from "./discover/route.js";
import type { DiscoveryRepository } from "./discover/types.js";
import { firehoseRoute } from "./firehose/route.js";

export type AppDeps = {
  discoveryRepo: DiscoveryRepository;
  claim: ClaimDeps;
  /** PR D firehose. The listener owns the LISTEN/NOTIFY connection;
   *  this emitter is its public surface. Tests inject a hand-rolled
   *  EventEmitter and emit FirehoseRow payloads directly. */
  firehoseEmitter: EventEmitter;
};

/** Build the Hono app with injected deps. Used by main.ts and by tests. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, service: "foxbook-api" }));

  // /api/v1/* per foundation §7.1.
  const v1 = new Hono();
  v1.route("/", discoverRoute(deps.discoveryRepo));
  v1.route("/", claimRoute(deps.claim));
  app.route("/api/v1", v1);

  // /firehose lives at the root path (NOT under /api/v1) — it's a
  // long-lived SSE stream, semantically different from the request/
  // response /api/v1 surface. Foundation §11 firehose architecture.
  app.route("/", firehoseRoute({ emitter: deps.firehoseEmitter }));

  return app;
}
