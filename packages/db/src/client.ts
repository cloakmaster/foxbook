// Two driver-specific Drizzle client factories over one shared schema.
//
// Option (b) split per Day-4 prep notes + Day-5 kickoff: packages/db
// exports `schema.*` and two named factories. Each consumer picks
// its driver; packages/db does NOT surface a "which client" dispatcher.
// Keeps packages/db's API surface flat and matches how day-2A crypto
// primitives are consumed (caller picks).
//
//   createNodeClient   postgres-js, drizzle-orm/postgres-js        — apps/api, scouts
//   createEdgeClient   @neondatabase/serverless, drizzle-orm/neon-http — Cloudflare Workers
//
// `createDbClient` is kept as a deprecated alias to `createNodeClient`
// so the existing apps/api import (`import { createDbClient } from
// "@foxbook/db"`) doesn't break mid-PR. Callers migrate on their own
// cadence; the alias is removed once no in-tree consumer references
// it (week 2).

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema/index.js";

/**
 * Node-runtime client (postgres-js). Connection-pooled, long-lived.
 * Use from apps/api, adapters that run on Node, and scout processes.
 *
 * Reads DATABASE_URL from process.env at call time so tests can inject
 * per-test URLs and no connection string is logged by this module.
 */
export function createNodeClient(url: string = process.env.DATABASE_URL ?? "") {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provide via process.env or pass explicitly to createNodeClient().",
    );
  }
  const client = postgres(url, {
    max: 1,
    idle_timeout: 20,
    prepare: false,
  });
  return drizzlePg(client, { schema });
}

/**
 * Edge-runtime client (@neondatabase/serverless + drizzle-orm/neon-http).
 * HTTP-based, stateless per query — no pools, no long-lived sockets.
 * Use from Cloudflare Workers, Vercel Edge Functions, or any runtime
 * that can't keep TCP sockets alive across invocations.
 *
 * The `url` MUST be passed explicitly — edge runtimes don't have
 * process.env in the Node sense; callers read from their own binding
 * (Worker env, Vercel env) and hand it in.
 */
export function createEdgeClient(url: string) {
  if (!url) {
    throw new Error(
      "createEdgeClient requires a DATABASE_URL — edge runtimes must pass it explicitly.",
    );
  }
  const sql = neon(url);
  return drizzleNeon(sql, { schema });
}

/**
 * @deprecated Use `createNodeClient` directly. Kept so existing
 * imports don't break mid-PR; remove once no in-tree consumer still
 * imports `createDbClient`.
 */
export const createDbClient = createNodeClient;

/**
 * Direct postgres-js client (raw `Sql` tagged template — NOT wrapped in
 * Drizzle). Returned as-is so callers can use postgres-js features
 * Drizzle does not surface, principally `sql.listen(channel, onNotify,
 * onListen)` for LISTEN/NOTIFY subscriptions.
 *
 * Reads DATABASE_URL_DIRECT (NOT DATABASE_URL). Throws loud if it's
 * missing or contains '-pooler' in the host. Pooled connections (Neon's
 * PgBouncer transaction-pooling) silently drop LISTEN subscriptions on
 * recycling, so any caller that needs LISTEN MUST go through this
 * factory and the direct URL — never silently fall back to the pooled
 * one. (PR D firehose listener; ADR 0004 addendum-2.)
 *
 * Connection options are tuned for long-lived listeners:
 *   - max: 1            — one connection per listener instance.
 *   - idle_timeout: 0   — never time out idle connections (LISTEN must
 *                          stay subscribed indefinitely).
 *   - max_lifetime: 0   — never recycle the connection on a clock.
 *   - prepare: false    — no prepared statements (cleaner shutdown).
 */
export function createDirectPostgresClient(
  url: string = process.env.DATABASE_URL_DIRECT ?? "",
): Sql {
  if (!url) {
    throw new Error(
      "createDirectPostgresClient: DATABASE_URL_DIRECT is not set. " +
        "LISTEN-using callers MUST use the non-pooled URL — pooled connections drop LISTEN subscriptions on recycling. " +
        "Set DATABASE_URL_DIRECT in .env.local or pass it explicitly. NEVER fall back to DATABASE_URL.",
    );
  }
  if (url.includes("-pooler")) {
    throw new Error(
      "createDirectPostgresClient: DATABASE_URL_DIRECT contains '-pooler' — must be a direct (non-pooled) Postgres URL.",
    );
  }
  return postgres(url, {
    max: 1,
    idle_timeout: 0,
    max_lifetime: 0,
    prepare: false,
    connection: { application_name: "foxbook-firehose-listener" },
  });
}

export type NodeDbClient = ReturnType<typeof createNodeClient>;
export type EdgeDbClient = ReturnType<typeof createEdgeClient>;
export type DirectPostgresClient = Sql;

/**
 * Union of both Drizzle client types. Most code paths don't care which
 * driver backs them (they hold a Drizzle interface), so this narrows
 * rarely. Merkle repository in `./merkle-repository.ts` accepts this
 * union. The direct postgres-js client is intentionally NOT in this
 * union — it's a different abstraction (raw SQL) for a different
 * purpose (LISTEN/NOTIFY).
 */
export type DbClient = NodeDbClient | EdgeDbClient;
