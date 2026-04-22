import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { discover } from "./handler.js";
import { discoverQuerySchema } from "./query-schema.js";
import type { DiscoveryRepository } from "./types.js";

/**
 * Mount the discover endpoint with an injected repository. Keeping the repo
 * outside this module is what makes tests able to drive the handler against
 * a fake without touching Postgres.
 */
export function discoverRoute(repo: DiscoveryRepository): Hono {
  const app = new Hono();
  app.get("/discover", zValidator("query", discoverQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const body = await discover(query, repo);
    return c.json(body);
  });
  return app;
}
