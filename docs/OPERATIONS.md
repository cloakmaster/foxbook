# Foxbook operations runbook

How to keep `transparency.foxbook.dev`, `api.foxbook.dev`, and `foxbook.dev` running unattended at low cost. Audience: future-Benjamin (or a future maintainer) needing to recover from incidents in month 6 without rebuilding mental context from scratch.

Per [ADR 0008 (stable-mode)](decisions/0008-stable-mode-maintenance-posture.md), Foxbook operates at best-effort SLA. This runbook is what makes "best-effort" actually achievable without daily attention.

---

## Future-you sanity check (read first when something breaks)

Before changing anything, run these five commands from any shell. Output tells you what's actually happening:

```bash
# Live signal — both endpoints + DNS
curl -sS https://api.foxbook.dev/healthz
curl -sS https://transparency.foxbook.dev/root | jq '.leafCount, .rootHash'
dig +short MX foxbook.dev

# Account / state
flyctl status -a foxbook-api
gh auth status
```

If `/healthz` and `/root` both return 200 and the leaf counts match, the system is functionally up; the rest is noise. If they disagree on leaf count, that's the **only** real anomaly worth chasing — it means the api side has appended a leaf the read side hasn't propagated yet, or vice versa. Wait 60 seconds and recheck (Cache-Control max-age is 60s on by-handle reads).

Then read the rest of this doc.

---

## Monthly cost (target <$30/month)

Confirm against actual billing dashboards quarterly. Estimates below are based on public pricing as of 2026-05.

| Service | Tier | Estimated monthly cost | Trigger to next tier |
|---|---|---|---|
| Fly.io `foxbook-api` | shared-cpu-1x, 256MB, fra region, `min_machines_running = 1` | $2-5 (depends on actual idle time) | Sustained CPU >80% or memory >220MB → bump to `shared-cpu-2x` (~$10/mo) |
| Cloudflare Workers `foxbook-transparency` | Free tier | $0 | 100,000 requests/day or 10ms CPU/request → Paid Workers ($5/mo) |
| Cloudflare Pages `foxbook-dev` | Free tier | $0 | 500 builds/month or 100,000 requests/day |
| Cloudflare Email Routing | Free | $0 | N/A — Email Routing is free up to high volumes |
| Neon Postgres | Confirm against dashboard | $0-19 | Free tier: 0.5 GB storage + 192 compute-hours/mo. Paid Launch: $19/mo flat. |
| Namecheap `foxbook.dev` | Annual registration | ~$1.25/mo amortized (~$15/yr) | N/A; .dev pricing per Namecheap |

**Total estimated**: $3–25/mo. Well under target.

**Cost spike triggers to watch**:
- Fly.io idle billing changes → check `fly.toml` `auto_stop_machines = 'stop'` is still set.
- Neon compute-hours go over → free tier resets monthly; verify `min_machines_running` on Fly isn't issuing constant heartbeat queries to Neon.
- Cloudflare Workers paid-tier upgrade → typically only happens if the transparency log gets >100k reads/day (which would be excellent and worth the $5/mo).

---

## Re-deploy each service

### `api.foxbook.dev` (Fly.io)

Routine re-deploy from a fresh local repo:

```bash
./scripts/deploy-api.sh
```

The script runs `flyctl deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile` from repo root. Build context is the repo root (the Dockerfile's `COPY . .` needs it).

CI-driven re-deploy: push a tag matching `v*-api`. `.github/workflows/deploy-api.yml` triggers on tag push, runs `flyctl deploy --remote-only` with `FLY_API_TOKEN` repo secret.

First-time setup is documented inline in `apps/api/fly.toml` lines 1-75. **Do NOT use the Fly web-UI "Launch from GitHub" flow** — it auto-detects the Python `pyproject.toml` at repo root and tries to build a Python deployable. Use `flyctl` CLI from repo root with explicit `--config` + `--dockerfile` flags.

Rollback: `flyctl releases --app foxbook-api` lists releases; `flyctl releases rollback <version> --app foxbook-api` rolls back. Each release gets a numbered version automatically.

### `transparency.foxbook.dev` (Cloudflare Worker)

Routine re-deploy from a fresh local repo:

```bash
pnpm --filter @foxbook/transparency cf:deploy
```

The pnpm script runs `wrangler deploy`. Custom-domain binding `transparency.foxbook.dev` was set in the Cloudflare dashboard 2026-04-28 (per `wrangler.toml` line 44 comment) and is permanent until manually unbound.

First-time setup is documented inline in `apps/transparency/wrangler.toml` lines 1-34.

Rollback: Cloudflare dashboard → Workers → `foxbook-transparency` → Deployments → click a prior version → Promote.

### `foxbook.dev` landing (Cloudflare Pages)

Phase 5 of the stable-mode plan ships the landing. Once deployed, the apex `foxbook.dev` resolves to Cloudflare Pages. Routine re-deploy: push to `main` triggers Cloudflare Pages's GitHub integration auto-build. Manual: `wrangler pages deploy apps/web/dist`.

---

## Key rotation

### Transparency-log signing key (`FOXBOOK_LOG_SIGNING_KEY_HEX`)

The Ed25519 key that signs every STH (`/root` response). Public key is exposed at `/.well-known/foxbook.json`.

**Rotation breaks the STH chain.** A scout that cached the prior public key and verifies STH signatures with it will reject every STH after rotation until they re-fetch the public key. There's no graceful overlap — Foxbook v0.2 doesn't ship dual-signing or key transition windows.

Rotation is a deliberate operation, not routine. Reasons to rotate: compromise of the private key, scheduled rotation per a security policy that doesn't exist today.

Procedure (when actually needed, not now):

```bash
# 1. Generate a new Ed25519 keypair (offline, on a clean machine)
node -e 'import("@noble/ed25519").then(e=>e.utils.randomPrivateKey()).then(b=>console.log(Buffer.from(b).toString("hex")))'

# 2. Rotate the secret on Fly.io
flyctl secrets set FOXBOOK_LOG_SIGNING_KEY_HEX='<new-64-char-hex>' --app foxbook-api

# 3. Update the public key in apps/api/.well-known/foxbook.json (committed)
# 4. Re-deploy the worker (so /.well-known matches Fly's signing)
pnpm --filter @foxbook/transparency cf:deploy
./scripts/deploy-api.sh

# 5. Notify scouts that may have cached the old public key
# (No formal channel today; commit a NOTICE / Discussion #1803 update.)
```

### Per-agent recovery key

Recovery keys are per-DID, not log-level. Per [ADR 0004](decisions/0004-tl-leaf-schema-evolution.md), revocation is recovery-key-signed; rotation of an agent's recovery key would require a different leaf shape that Foxbook v0.2 does not ship. Filed for a future ADR if/when needed.

### Per-agent signing key (rotation)

Per [tl-leaf v1.2](decisions/0004-tl-leaf-schema-evolution.md) addendum-3, the `signing-key-registration` shape is locked in. The flow that emits these leaves is filed for a follow-up that, under stable mode, does not ship. If a future maintainer wants to enable signing-key rotation, the schema is ready; the handler at `apps/api/src/claim/handlers.ts` would need a `claimRotateSigningKey` function inside a `db.transaction` body following the same atomicity rule as `claimRevoke` (ADR 0004 addendum-1).

---

## Incident response

### Scenario A — log corruption / fork detected

Symptom: a scout reports an inclusion proof that doesn't reconstruct against `/root`. Or `/inclusion/N` returns a `rootHex` that doesn't match what `/root` returned just seconds ago.

Steps:

1. Compare `transparency.foxbook.dev/root` and `api.foxbook.dev/healthz` (`leafCount`). If they disagree by more than 1 leaf, Cloudflare Worker is reading a stale Postgres replica. Wait 60s; if persistent, check Neon's read-replica health.
2. Pull the suspect leaf via `curl -sS https://transparency.foxbook.dev/leaf/N` (or `/inclusion/N`); compare leaf bytes against the Postgres `tl_leaves` row at index N (production DB; Neon dashboard → SQL editor).
3. If the bytes match: the issue is proof reconstruction logic, not corruption. Re-run with the SDK locally; file a bug.
4. If the bytes diverge: that's a real corruption event. Take the api offline immediately (`flyctl scale count 0 --app foxbook-api`); preserve the Neon DB state via point-in-time backup; investigate. The transparency log's append-only invariant is the canonical guarantee; any divergence is a security-grade event.

This has never happened in production. The `pnpm check:core-isolation` + canonical-bytes-once rule (ADR 0005) makes it structurally hard.

### Scenario B — forged claim in the wild

Symptom: an external party reports an AgentCard verifying as `verified` for a handle the original holder didn't claim.

Steps:

1. Confirm the report: run `verifyAgentCard(card)` locally against the deployed log. If it returns `verified` and the leaf+key really do appear in the log, that's a real claim — investigate how the original handle holder lost control of the recovery flow.
2. The original holder's recourse: revoke the claim using their recovery key (`POST /api/v1/claim/revoke` with a recovery-key-signed JWS). This is the designed path; revocation is atomic per [ADR 0004 addendum-1](decisions/0004-tl-leaf-schema-evolution.md).
3. If the recovery key was compromised (not just the signing key): there's no recovery-key rotation in v0.2. Hand-walk the original holder through opening a new claim under a new recovery key + asset-conflict resolution.
4. Document the incident in `ops/evidence/<date>-forged-claim-<handle>.md` with the Discussion thread / email trail.

### Scenario C — leaked secret

Symptom: `FOXBOOK_LOG_SIGNING_KEY_HEX`, `DATABASE_URL`, or `RESEND_API_KEY` leaked (committed to a public repo, posted in chat, exposed in logs).

Steps:

1. **Rotate immediately**, do not wait for the audit:
   - `FOXBOOK_LOG_SIGNING_KEY_HEX` → run the key-rotation procedure above
   - `DATABASE_URL` / `DATABASE_URL_DIRECT` → Neon dashboard → connection settings → reset password; update Fly + Cloudflare secrets via `flyctl secrets set` and `wrangler secret put`
   - `RESEND_API_KEY` → Resend dashboard → revoke key + create new; update `flyctl secrets set RESEND_API_KEY=...`
2. After rotation: investigate the leak source. Check the public repo for the leak commit (`git log --all -p -S '<key-prefix>'`), force-push a clean history if needed, and rotate again if any exposure window remains.
3. Document in `ops/evidence/<date>-secret-rotation-<which>.md`.

---

## Database backups (Neon)

Neon's automated backups: continuous WAL streaming with point-in-time-restore (PITR) within a retention window depending on tier:

- **Free tier**: 7-day PITR window.
- **Launch tier ($19/mo)**: 14-day PITR window.
- **Scale tier**: 30-day PITR window.

Confirm current tier in Neon dashboard → project → Settings → Plan. Stable-mode default is whatever tier you're on; **do not downgrade if you're on Launch+** — the larger PITR window is genuine recovery insurance for a transparency log.

### Restore procedure

1. Neon dashboard → project → Branches → click `main` branch → click "Restore" button at top.
2. Pick a point-in-time within the PITR window. Neon creates a new branch from that point.
3. Promote the new branch to primary OR update Fly + Worker `DATABASE_URL` secrets to point at the new branch's pooled URL.
4. Verify via `/healthz` that `leafCount` matches expectations.

PITR restore is for catastrophic data loss, not routine rollback. The transparency log's append-only invariant means you should NEVER need to roll back log state — by design, it grows monotonically and never rewrites.

---

## Uptime monitoring

`.github/workflows/uptime.yml` runs every 15 minutes via cron. It pings `https://transparency.foxbook.dev/root`, `https://api.foxbook.dev/healthz`, and `https://foxbook.dev/`. On failure (non-2xx response or timeout):

- Opens a GitHub issue tagged `uptime-incident` if no open incident issue exists for that endpoint.
- Comments on an existing incident issue with the latest failure timestamp.
- Closes the issue automatically when the endpoint recovers.

GitHub notification settings determine when you get paged. Default settings email Benjamin on issue open and close; that's the alert channel.

### Silencing alerts during planned maintenance

```bash
# Disable the workflow temporarily
gh workflow disable uptime.yml

# Re-enable when done
gh workflow enable uptime.yml
```

Or comment `bot: silence 1h` on an open incident issue (placeholder — the workflow doesn't read silencing comments today; if needed, extend the workflow).

### Why every 15 minutes, not 5

GitHub Actions free-tier runner-minutes are unlimited on public repos but throttled on private. The uptime check is ~5-10 sec per run; at 15-min intervals that's ~3 hours of runner time per month — well under any limit. At 5-min intervals it's 9 hours. Both are fine; 15 min is the conservative default. Bump to 5-min via the `cron:` line if false-positive pressure justifies it.

---

## Phase 5 stable-mode landing (foxbook.dev)

Once Phase 5 ships the Cloudflare Pages landing:
- Source lives at `apps/web/`. Single hero page.
- Cloudflare Pages auto-builds on push to main.
- Custom domain `foxbook.dev` is bound at the Cloudflare Pages dashboard.

Re-deploy: routine push to `main` triggers a build. Manual: `wrangler pages deploy apps/web/dist --project-name foxbook-web`.

---

## What this runbook deliberately does NOT cover

- **CI workflow internals** — `.github/workflows/ci.yml` runs node + python + go on push/PR. If it breaks, read the workflow file directly; it's small.
- **Test failures** — bugs are tracked as GitHub issues; security issues to `hello@foxbook.dev`.
- **Feature additions** — feature freeze per ADR 0008. Reply pattern: "Stable mode; spec extension request noted."
- **The protocol contract** — frozen at v0.2. ADRs 0001-0008 are the spec of what's frozen.

---

## Cross-references

- [ADR 0008 — stable-mode maintenance posture](decisions/0008-stable-mode-maintenance-posture.md)
- [ADR 0004 — tl-leaf schema evolution + revocation atomicity](decisions/0004-tl-leaf-schema-evolution.md)
- [ADR 0007 — HTTP cache + read/write split](decisions/0007-http-cache-and-read-write-split.md)
- [`apps/api/fly.toml`](../apps/api/fly.toml) — first-time deploy sequence (lines 1-75)
- [`apps/transparency/wrangler.toml`](../apps/transparency/wrangler.toml) — Worker deploy sequence
- [`docs/operations/env-vars.md`](operations/env-vars.md) — secrets reference
- [`scripts/deploy-api.sh`](../scripts/deploy-api.sh) — Fly.io deploy wrapper
