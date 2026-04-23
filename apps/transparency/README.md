# @foxbook/transparency

Cloudflare Worker at `transparency.foxbook.dev` — read-only surface over the Merkle transparency log. Route + cache policy:

| Route | Behavior | Cache-Control |
|---|---|---|
| `GET /health` | `{ok, service}` | (default) |
| `GET /root` | latest STH | `no-store` |
| `GET /leaf/:index` | leaf row | `immutable, max-age=31536000` |
| `GET /inclusion/:index` | inclusion proof | `immutable` |
| `GET /consistency?old=N&new=M` | consistency proof | `immutable` |
| `GET /schemas/{envelope,agent-card,x-foxbook,tl-leaf}/v1.json` + `/schemas/merkle-test-vectors.json` | committed schema JSON | `public, max-age=300` |

Read-only. Never writes. Never appends. The Worker instantiates `createMerkleRepository(db, {})` **without a signing key** — any accidental `append()` call throws at runtime per the PR #13 guardrail.

## Deploy

**From `apps/transparency/`** (so `wrangler` picks up `wrangler.toml`):

```bash
# 1. Bind wrangler to your Cloudflare account.
wrangler login

# 2. Put DATABASE_URL in Cloudflare's SECRET store.
#    Paste the same Neon URL as .env.local when prompted.
wrangler secret put DATABASE_URL

# 3. Ship the Worker.
pnpm --filter @foxbook/transparency deploy
```

Step 2 is load-bearing. Without it, `/root`, `/leaf/:index`, `/inclusion/:index`, and `/consistency` all 500 because `@neondatabase/serverless` has no connection URL at request time. The symptom is "the Worker is broken"; the actual cause is "the Worker has no DB credentials."

**DATABASE_URL is a SECRET, never a `[vars]` entry.** If it's declared under `[vars]` in `wrangler.toml`, it gets baked into the Worker bundle and surfaces in plaintext on the Cloudflare dashboard — a credential leak. `wrangler.toml`'s header carries this warning; don't add `[vars]` DATABASE_URL.

## Verify the deploy

From a **fresh shell** (no cookies, no auth, no app context):

```bash
WORKER_URL="https://foxbook-transparency.workers.dev"  # or transparency.foxbook.dev once DNS binds
curl -s "$WORKER_URL/health" | jq .
curl -s "$WORKER_URL/root" | jq .
curl -s "$WORKER_URL/leaf/0" | jq .
curl -s "$WORKER_URL/inclusion/0" | jq .
```

200 + valid JSON on every route ⇒ the log is **publicly verifiable**, which is the actual week-1 north-star artifact. If `/leaf/0` returns 404, the log is empty; run `pnpm smoke:tier1` against `apps/api` first to write the first leaf.

## Local dev

```bash
pnpm --filter @foxbook/transparency dev
# wrangler dev — binds Neon via the DATABASE_URL from .env.local
```

Local dev reads `.env.local` via `wrangler dev`'s default behavior. Production reads the secret binding. Same variable name in code either way.

## Tests

```bash
pnpm --filter @foxbook/transparency test
```

24 route tests with an in-memory fake `MerkleRepository` via `vitest`'s Hono integration (`app.request()`). Runtime-on-Workers validation is a post-deploy smoke test (`curl` sequence above); the unit tests cover the route / cache-header / proxy contracts.
