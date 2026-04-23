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
import postgres from "postgres";

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

export type NodeDbClient = ReturnType<typeof createNodeClient>;
export type EdgeDbClient = ReturnType<typeof createEdgeClient>;

/**
 * Union of both client types. Most code paths don't care which driver
 * backs them (they hold a Drizzle interface), so this narrows rarely.
 * Merkle repository in `./merkle-repository.ts` accepts this union.
 */
export type DbClient = NodeDbClient | EdgeDbClient;
