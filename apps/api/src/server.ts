import { Hono } from "hono";
import type { ClaimDeps } from "./claim/handlers.js";
import { claimRoute } from "./claim/route.js";
import { discoverRoute } from "./discover/route.js";
import type { DiscoveryRepository } from "./discover/types.js";

export type AppDeps = {
  discoveryRepo: DiscoveryRepository;
  claim: ClaimDeps;
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

  return app;
}
