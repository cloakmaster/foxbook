# Preflight — shape-only checks at Day-N kickoff

Every Day-N kickoff runs a **shape-only preflight** before any code lands.
Each check answers YES or NO; values are never read or echoed. The point is
to catch the regression class that a prior Day-N retro showed up — every
flag below maps to a specific past failure that cost time.

## How to run

```
bash scripts/preflight-day-N.sh
```

Exit 0 = all checks passed. Non-zero = one or more failed; the failed flag
name is printed in the `FAIL  NN name` line.

## How to add a flag for a specific Day

`scripts/preflight-day-N.sh` is the canonical, committed list — flags 1–14.
Day-N-specific checks (e.g. "Day-7: scout-side revocation enforcement is
wired") go in `scripts/preflight-day-N.local.sh` instead. The canonical
script sources that file if present; it is gitignored so per-day flags
don't accumulate in the repo.

Pattern in the local file:

```bash
fXX() { <shape-only test command>; }
check "XX short-name" fXX
```

Numbering picks up wherever the canonical 14 left off.

## Why shape-only

Echoing the value of a secret turns it into a transcript artifact —
terminal scrollback, copy-paste, any session recording (`script(1)`,
telemetry, IDE plugins). Shape-only checks answer "does the variable
have the right prefix and host structure" without reading the value.

A leak attempt costs nothing to refuse; a leak that lands costs a
rotation.

## The 14 canonical flags

| # | Name | What it checks | Failure mode it prevents |
|---|---|---|---|
| 01 | `env_local_exists` | `.env.local` is present at repo root | Day-1 — startup against wrong env file, silent fallbacks |
| 02 | `database_url_pooled` | `DATABASE_URL` starts `postgresql://` AND host contains `-pooler` | Day-2 — accidental writes to the non-pooled endpoint while pooled is the operational expectation |
| 03 | `resend_api_key_prefix` | `RESEND_API_KEY` starts `re_` | Day-3 — typo / wrong-vendor key (Postmark / SendGrid) leading to silent send failure |
| 04 | `env_local_gitignored` | `git check-ignore .env.local` succeeds | Day-2 — accidental `.env.local` commit to public history |
| 05 | `core_isolation` | `pnpm check:core-isolation` exits 0 | Day-1 — service-agnostic core importing from adapters / framework code |
| 06 | `generated_types` | `pnpm check:generated` exits 0 (8 files match) | Day-3 — schema diverged from generated TS/Py types, silent drift between SDK + API |
| 07 | `migrations_in_journal` | Migrations 0001 + 0002 are present in `packages/db/migrations/meta/_journal.json` | Day-5 — drizzle-kit generate run but file uncommitted, fresh checkout missing migrations |
| 08 | `core_tests_green` | `pnpm --filter @foxbook/core test` exits 0 (53 tests today) | Day-1 — core regressions land via downstream PRs that didn't run core tests |
| 09 | `tsx_wired` | `apps/api/package.json` declares `tsx` AND scripts use `--import tsx`, NOT `--experimental-strip-types` | Day-5 — Node v25 dropped the `.js` → `.ts` resolution shortcut; gate-2 first attempt failed mid-deploy |
| 10 | `wrangler_v4` | `apps/transparency/node_modules/.bin/wrangler --version` major ≥ 4 | Day-5 — wrangler 3 ships esbuild 0.17 which doesn't understand `with { type: "json" }` import attributes; gate-3 first deploy failed |
| 11 | `migrate_scripted` | `packages/db/package.json` `db:migrate` script points at `./scripts/migrate.mjs` | Day-5 — `drizzle-kit migrate` swallows error text behind ora spinner; the scripted migrator owns transition-gap detection |
| 12 | `cf_deploy_named` | `apps/transparency/package.json` has `cf:deploy`, has NO `deploy` script | Day-5 — `pnpm deploy` is a built-in pnpm command (copies workspace dist); the rename to `cf:deploy` prevents collision |
| 13 | `canonical_both_sides` | `merkle-repository.ts` has `readAllLeafHashes`, NOT `readAllLeafPreimages`, NO `canonicalJsonBytes(r.leafData)` | Day-5 — re-hashing jsonb on read returns a different digest than write-time, breaking inclusion proofs (PR #25 fix; ADR 0005) |
| 14 | `database_url_direct_shape` | `DATABASE_URL_DIRECT` starts `postgresql://` AND host does NOT contain `-pooler` | Day-6 — Neon pooler drops session-level `LISTEN` on connection recycling; firehose subscription needs a non-pooled connection |

The mapping in the right column is the load-bearing column. A flag
without a documented failure mode is dead weight; remove or replace it.

## Adding a new canonical flag

If a Day-N retro identifies a regression that's worth catching for
every future Day-N, promote the local override to the canonical script:

1. Move the flag function from `scripts/preflight-day-N.local.sh` to
   `scripts/preflight-day-N.sh`, numbered N+1.
2. Add the row to the table above with its retro reference.
3. Bump the documented count (e.g. "14 canonical flags" → "15").

Removal is allowed only when the underlying failure mode is structurally
prevented (e.g. a CI rule replaces the preflight check).
