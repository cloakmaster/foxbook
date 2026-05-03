# ADR 0007 — HTTP cache-control policy + read/write deployment split

**Status:** Accepted
**Date:** 2026-04-30

## Context

Foxbook surfaces two public HTTP services:

- **`https://transparency.foxbook.dev`** — Cloudflare Worker, read-only Merkle log endpoints (`/root`, `/leaf/:i`, `/inclusion/:i`, `/consistency`). Append happens elsewhere; this surface only reads.
- **`https://api.foxbook.dev`** — Fly.io-deployed Node.js server (`apps/api`), write-side claim flow (`POST /api/v1/claim/start`, `…/verify-gist`, `…/revoke`, …). Day-9 PR-A2 also adds a public read endpoint (`GET /api/v1/claim/by-handle/:asset_type/:asset_value`) on this side because the data lives in the relational claims table that the Worker doesn't have a connection to.

Three policy questions kept coming up across PRs:

1. What `Cache-Control` should each response set?
2. Should the read-side and write-side ever merge into one deployment?
3. When `/claim/list` (or any list-shaped endpoint) eventually ships, what pagination model?

Each was answered ad-hoc per PR. This ADR codifies the answers as durable architectural rules so future-PRs don't re-litigate.

## Decision

### 1. Cache-Control policy across read endpoints

| Surface | Cache-Control |
|---|---|
| `/root` (current STH) | `no-store` — STH updates per leaf append; clients MUST always revalidate. |
| `/leaf/:i`, `/inclusion/:i`, `/consistency?old=&new=` | `public, max-age=31536000, immutable` — content-addressable; leaf at index N can never change. |
| `/api/v1/claim/by-handle/:asset_type/:asset_value` | `public, max-age=60, must-revalidate` — claim state can transition (e.g. tier1_verified → tier2_pending → tier2_verified); 60s is the freshness window we accept for cached reads. |
| `/api/v1/discover` | `public, max-age=60, must-revalidate` — same reasoning. |
| `/.well-known/foxbook.json` | `public, max-age=300` — protocol-discovery surface; changes rarely. |
| `/healthz`, `/health` | `no-store` — operational state, never cache. |
| `/schemas/*` | `public, max-age=300` — additive within v1.x per ADR 0004; 5min is enough for clients to pick up additions. |

The 60-second `max-age` on dynamic-state read endpoints is the SLO surface for any future Cloudflare edge cache in front of `api.foxbook.dev`. When edge caching is introduced, no change to the `Cache-Control` headers is needed — the existing values drive the cache automatically.

### 2. Read/write deployment split is permanent

`api.foxbook.dev` (write-side, Fly.io) and `transparency.foxbook.dev` (read-side, Cloudflare Worker) stay separate. Standard transparency-log infrastructure pattern (mirrors Certificate Transparency's log servers vs monitor/auditor split).

Why permanent:
- **Read scaling is via edge caching** — Cloudflare in front of the Worker (today) and in front of `api.foxbook.dev` (future, when traffic warrants it) lets us absorb 10×-100× spikes without touching the write path.
- **Write scaling is via region replication** — Postgres + Fly.io region replication is the path; that's a different operational model from the Worker's edge-cached read shape.
- **Operational independence** — a Worker incident doesn't take down claim writes; a write-path Postgres outage doesn't take down the read-side Merkle queries.

If a future PR proposes merging them ("simpler operations" / "fewer deployments"), reject — the proposed simplification trades architectural durability for one fewer deploy command. Re-open via a new ADR if the operational data ever justifies it.

### 3. Pagination policy for any future list-shaped endpoint

When `/api/v1/claim/list`, `/api/v1/claim/search`, or any similar list-shaped endpoint ships, **it MUST be cursor-based**, never offset-based.

Cursor-based:
- Stable under concurrent inserts/deletes (the cursor pins a specific row's position).
- Scales linearly to 100M+ rows.
- Forces clients into a "fetch-the-next-page" loop, not a "jump-to-page-N" pattern that leaks pagination internals.

Offset-based:
- Breaks under concurrent writes (rows shift; a client iterating offsets sees duplicates or skips).
- Performance degrades as O(offset) on Postgres for large offsets.
- Forces clients into broken assumptions about result ordering being a stable address.

This ADR pins the constraint now, before any list-shaped endpoint exists, so the first one ships cursor-based without litigation.

## Consequences

- Every new read endpoint MUST set a `Cache-Control` header. Reviewers reject PRs that add read routes without one.
- Future PRs proposing to merge `api.foxbook.dev` + `transparency.foxbook.dev` MUST file an ADR amendment with justification rooted in operational data (latency, error rates, cost), not subjective "simpler" claims.
- Future PRs proposing offset-based pagination on a new endpoint MUST file an ADR amendment justifying why this case differs from the rule.

## Cross-references

- ADR 0001 — service-agnostic core (HTTP-cache-policy is generic; service-agnostic).
- ADR 0002 — forward-only migrations (the read endpoints surface columns from `claims`, `tl_leaves`, etc.; cache-policy doesn't change those).
- ADR 0004 addendum-1 — delete-on-revoke (informs the `revoked: false` field on `/claim/by-handle` — revoked rows return 404, not `revoked: true`).
- ADR 0005 — canonical bytes once (the Merkle leaf reads at `/leaf/:i` use the immutable cache shape because canonical bytes never change).
- `apps/api/fly.toml` — write-side deploy config.
- `apps/transparency/wrangler.toml` — read-side deploy config.
