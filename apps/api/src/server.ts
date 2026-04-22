import { Hono } from "hono";
import { discoverRoute } from "./discover/route.js";
import type { DiscoveryRepository } from "./discover/types.js";

export type AppDeps = {
  discoveryRepo: DiscoveryRepository;
};

/** Build the Hono app with injected deps. Used by main.ts and by tests. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true, service: "foxbook-api" }));

  // /api/v1/discover lives under /api/v1 for parity with foundation §7.1.
  const v1 = new Hono();
  v1.route("/", discoverRoute(deps.discoveryRepo));
  app.route("/api/v1", v1);

  return app;
}
