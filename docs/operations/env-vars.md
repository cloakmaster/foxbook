# Environment variables

Source of truth for environment variable naming and injection paths under stable mode. Keep this in lockstep with `.env.example` (root). Crypto private keys are never stored in plaintext — recovery and signing keys are minted via offline controlled flows.

For the full operations runbook (deploy, key rotation, incident response, backups, monitoring), see [`docs/OPERATIONS.md`](../OPERATIONS.md).

---

## Production secrets

### Fly.io — `foxbook-api` (`api.foxbook.dev`)

Set via `flyctl secrets set <KEY>='<value>' --app foxbook-api`. Never `[env]` entries — that's a credential leak.

| Variable | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | Neon Postgres pooled connection (read + write traffic) | Neon dashboard → connection details → "Pooled connection" |
| `DATABASE_URL_DIRECT` | Neon Postgres non-pooled connection (migrations, transactions needing `pg_advisory_xact_lock`) | Neon dashboard → connection details → "Direct connection" |
| `RESEND_API_KEY` | Resend transactional email API key | Resend dashboard → API Keys |
| `FOXBOOK_LOG_SIGNING_KEY_HEX` | Ed25519 private key for STH signing. 64-char hex (32 bytes raw). Public counterpart served at `/.well-known/foxbook.json` | Generated offline; rotated via [`docs/OPERATIONS.md`](../OPERATIONS.md) § Key rotation |
| `FOXBOOK_FIREHOSE_ENABLED` | Feature flag (not a secret) gating the SSE `/firehose` Postgres `LISTEN/NOTIFY` subscriber. `"true"` enables; anything else (or unset) disables. **Disabled by default** since [#84](https://github.com/cloakmaster/foxbook/pull/84) — the always-on listener holds an open connection 24/7 and consumed Neon free-tier compute hours with no documented external consumers. The `/firehose` route is still served when disabled (subscribers see only the SSE heartbeat). | Set to `true` only when an integrator needs the firehose surface |

### Cloudflare Workers — `foxbook-transparency` (`transparency.foxbook.dev`)

Set via `wrangler secret put <KEY>` from `apps/transparency/`. Never `[vars]` entries — `[vars]` get baked into the Worker bundle in plaintext.

| Variable | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | Same Neon pooled URL as Fly. Read-only path on the Worker; the write path lives on api.foxbook.dev. | Same as Fly's `DATABASE_URL` |

---

## Local development

Copy `.env.example` to `.env.local` (gitignored). Variables and required scopes are listed in `.env.example`.

For local Postgres, use a Neon branch (Neon dashboard → Branches → New). Never use the production `DATABASE_URL` for local development.

---

## What's deliberately not here

- **Vercel / Upstash / KMS env vars** — earlier scaffolding from pre-stable-mode planning that didn't ship. Removed under stable mode to match production reality.
- **Scout wallet keys** — scouts don't transact in v0.2; key management filed for a future ADR if/when scouts ship.
- **MeiliSearch / discovery API** — discovery surface deferred per [ADR 0008](../decisions/0008-stable-mode-maintenance-posture.md).
