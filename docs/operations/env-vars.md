# Environment variables

Source of truth for environment variable naming and injection paths. Keep this in lockstep with `.env.example` (root). See `docs/foundation/LOCKED.md` for the "no plaintext crypto private keys" rule.

---

## Local development — `.env.local` (gitignored)

Copy `.env.example` to `.env.local`. Variables are listed there with comments on required scope.

---

## Vercel (prod + staging)

Set via `vercel env add <KEY> <value>` or the dashboard. Never commit values.

| Variable | Purpose | Notes |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection | Injected from Neon integration. Use branch URLs for staging. |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | |
| `CLOUDFLARE_ACCOUNT_ID` | CF account for Durable Object bindings | |
| `FOXBOOK_SIGNING_KEY_KMS_ARN` | AWS KMS ARN (or CF Workers Secret binding name) for Foxbook's Ed25519 signing key | **NOT the key material.** Holds the reference to KMS. Renaming from `FOXBOOK_SIGNING_KEY` was deliberate: a `_KMS_ARN` variable can't accidentally receive pasted private key bytes without someone noticing. |
| `SENTRY_DSN` | Error reporting | Public; safe to ship to client. |
| `AXIOM_TOKEN` | Structured logs | |

---

## Deferred until week 2+

| Variable | Why deferred | Decision point |
|---|---|---|
| Scout wallet private keys | Scout wallet key management is unresolved. Options: KMS-per-scout vs. Cloudflare Workers Secrets vs. HSM. The security architecture is a week-2 call. | **Do NOT inject plaintext `SCOUT_WALLET_PRIVATE_KEY_*` env vars in V1.** Scouts don't transact in week 1. |
| `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` | Discovery API on Meilisearch lands week 2 | Week 2 kickoff. |

---

## MCP servers (project scope)

Day 1 installed via `claude mcp add --scope project ...`. Config lives at `.mcp.json` at the repo root — project-scoped so the config travels with the repo.

| MCP | Install command | Auth |
|---|---|---|
| github | `claude mcp add --scope project github -- npx -y @modelcontextprotocol/server-github` | `GITHUB_PERSONAL_ACCESS_TOKEN` env var |
| context7 | `claude mcp add --scope project context7 -- npx -y @upstash/context7-mcp` | Free; optional API key |

**Day 2:** Neon MCP. The local npm package `@neondatabase/mcp-server-neon` is deprecated — use Neon's **remote** MCP endpoint instead (see `https://neon.com/docs/ai/neon-mcp-server`). Configure via `claude mcp add --scope project --transport sse neon <URL>` once the Neon project exists.

**Week 2+:** Cloudflare MCP, Vercel MCP, Sentry MCP, Playwright MCP (Moltbook scraper).

---

## Never install

- MCPs wrapping paid-tier-only APIs — V1 is free-forever.
- Slack / Teams / Asana / Notion MCPs — not load-bearing, noise in tool surface.
- Anthropic / OpenAI / Google model-provider MCPs — crypto, Merkle log, and discovery don't need them.
