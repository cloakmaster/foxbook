import { createDbClient } from "@foxbook/db";
import { serve } from "@hono/node-server";
import { DrizzleDiscoveryRepository } from "./discover/repository.js";
import { createApp } from "./server.js";

const port = Number(process.env.PORT ?? 8787);
const db = createDbClient();
const app = createApp({ discoveryRepo: new DrizzleDiscoveryRepository(db) });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`foxbook-api listening on http://localhost:${info.port}`);
});
