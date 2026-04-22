import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

/**
 * Lazy Postgres client. Reads DATABASE_URL from process.env at call time so:
 *   - tests can inject a per-test URL via environment
 *   - CI / Vercel / local dev each use their own binding
 *   - no connection string is ever logged by this module
 */
export function createDbClient(url: string = process.env.DATABASE_URL ?? "") {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provide via process.env or pass explicitly to createDbClient().",
    );
  }
  const client = postgres(url, {
    // Neon pooler expects SSL; the URL already carries sslmode=require.
    // max is intentionally small for serverless; bump in a follow-up once
    // we know the deployment topology.
    max: 1,
    idle_timeout: 20,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
export * as schema from "./schema/index.js";
