# @foxbook/db

Shared Drizzle schema + migrations + two driver-specific client factories.

## Which client?

| Runtime | Factory | Driver |
|---|---|---|
| Node (apps/api, scouts, adapters) | `createNodeClient(url?)` | `postgres-js` + `drizzle-orm/postgres-js` |
| Cloudflare Workers / edge | `createEdgeClient(url)` | `@neondatabase/serverless` + `drizzle-orm/neon-http` |

Both factories return Drizzle clients bound to the same `schema.*`. Callers pick their driver; this package does not dispatch at runtime. See `src/client.ts` for the rationale (option (b) schema-only export from the Day-5 kickoff plan).

## Migrations

`drizzle-kit generate` emits reviewable SQL under `migrations/`. Apply via `pnpm db:migrate` from a developer terminal against a specific environment. Never `db:push` after the v0 bootstrap — see ADR 0002.

## Public API

- `schema.*` — every table defined under `src/schema/`, re-exported flat.
- `createNodeClient` / `createEdgeClient` — driver-specific factories.
- `createDbClient` — deprecated alias to `createNodeClient`, removed once no in-tree consumer references it.
- `createMerkleRepository(db, opts)` — single persistence boundary for the RFC 9162 Merkle transparency log. Accepts either client type.
