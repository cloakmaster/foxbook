# ADR 0002 — Database layer discipline

**Number:** 0002
**Date:** 2026-04-22
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0001 (service-agnostic core)

## Context

PR #5 (`029e668`) landed Drizzle schema v0 — 10 tables on a Neon dev branch, first migration at `packages/db/migrations/0000_v0_schema.sql`. The schema was applied via `drizzle-kit push --force`, which is fine for a one-time bootstrap against an empty database but dangerous as a habit: `push` diffs the live database against the schema and applies changes without emitting a reviewable migration file. Every subsequent schema evolution needs a durable artefact in git — otherwise two developers drift on "what is the current schema" the first time anyone runs `push` on a branch that didn't also get pushed to prod.

This ADR fixes that discipline before the next schema PR lands. It also pins where Drizzle lives in the monorepo (adjacent to ADR 0001's service-agnostic core rule) and clarifies what a destructive change looks like so reviewers have a single signal to check.

## Decision

Five rules, all enforced by convention + PR review (no CI gate today — these are disciplines, not mechanical checks).

1. **Forward-only migrations.** A destructive DDL change (`DROP TABLE`, `ALTER TABLE ... DROP COLUMN`, `RENAME`, non-additive `TYPE` change) MUST be called out in the PR description with a paragraph explaining the migration path: why the change is safe for current callers, how historical data is preserved or discarded, and what (if anything) must be backfilled. `RENAME` counts as destructive because it's drop-plus-add from the perspective of every client still referencing the old name. Additive changes — new table, new nullable column, new index, new enum value at the end — proceed normally, no PR-description paragraph needed.

2. **Drizzle lives in `packages/db/`, not `core/db/`.** ORMs encode vendor- and driver-adjacent choices (postgres-specific types, connection pooling details, migration engines) that would pull `core/` into service-adjacent territory. ADR 0001 keeps `core/**` and `packages/**` service-agnostic; Drizzle + postgres-js is legal in `packages/**` because it's a primitive, but it must not be re-exported from `core/**` or imported by `adapters/**` (adapters are for *named services*, not infrastructure).

3. **`drizzle-kit push` was a one-time bootstrap for v0 (PR #5). No `push` after v0.** Every subsequent schema change uses `drizzle-kit generate` (emits a reviewable `.sql` file) → commit `migrations/` alongside the schema change in the same PR → `drizzle-kit migrate` applies the committed migration to prod. `db:push` stays in `packages/db/package.json` for local experimentation, but its use in any PR that changes `packages/db/src/schema/**` is a review-blocker.

4. **`migrations/` and `migrations/meta/` ship in the same PR as the schema change.** Schema edit in one commit, `drizzle-kit generate` output in the next, both in the same PR. A schema-change PR without migration files is incomplete and gets bounced.

5. **Schema PRs reference this ADR in the description; no new ADR per migration.** Link to `docs/decisions/0002-db-layer-discipline.md` in the PR body. ADRs are for decisions, not for changelog; a new ADR lands only when one of these five rules needs to change.

## Enforcement

Today: PR review against CODEOWNERS. `packages/db/`, `docs/foundation/`, `docs/decisions/`, and `.github/workflows/` all list `@cloakmaster` as owner, so any violation shows up at review time with one reviewer required.

Tomorrow (follow-up, if it ever gets gamed): a lint script that inspects migration SQL files for destructive statements and requires a marker comment confirming the PR description paragraph exists. Not building that today — discipline-by-review is cheaper and the team is one person.

## Consequences

- **`generate` → commit → `migrate` is the happy path.** Every schema change has a reviewable `.sql` artefact; merging the PR is identical to applying the migration to prod, and `git bisect` over schema state works the same way it works over code state.
- **No silent schema drift between environments.** Because `push` is retired, a laptop can't be in a different state from `main`; the migration files are the source of truth.
- **Destructive changes take longer to ship.** The PR description paragraph costs a few minutes but forces the author to think about callers. That's the point.
- **`packages/db` is the only place drizzle-orm and postgres-js are imported.** Discovery API, firehose, and scouts consume via `@foxbook/db`'s public exports (`createDbClient`, `schema.*`). No drizzle imports in `apps/**` or `adapters/**`.

## Alternatives considered

- **Keep using `drizzle-kit push` indefinitely.** Rejected. `push` is designed for solo rapid prototyping, not for a repo with branch protection + CODEOWNERS + a multi-environment story. The moment two developers run `push` on different branches, "what's the schema" becomes ambiguous.
- **`generate` plus auto-apply in CI.** Rejected for V1. Auto-applying migrations against production on merge requires mature rollback tooling (CI-visible rollback tests, dry-run planning, time-boxed locks) that doesn't exist yet. Until it does, `migrate` runs from a developer's terminal against a specific environment, by hand, and the migration file is the audit.
- **Put Drizzle schema in `core/db/`.** Rejected by ADR 0001. Core must stay service-agnostic; even "generic" ORMs encode backend-specific choices.

## Verified

PR #5 (`029e668 feat(db): Drizzle schema v0 — 10 tables, first migration, pushed to Neon`) is the evidence that rule 3 was followed correctly: the first schema landed via a single `drizzle-kit push --force` against an empty Neon dev branch, the corresponding migration file `packages/db/migrations/0000_v0_schema.sql` was emitted via `drizzle-kit generate` and committed alongside, and the `migrations/meta/` directory was populated. Every subsequent schema PR from day 3 onward is expected to skip `push` entirely.

## When this rule can be violated

Only with a superseding ADR and `@cloakmaster` sign-off. If a schema change ever needs `db:push` (for example: recovering from a migration-engine corruption on a dev branch, or a bulk reshape that `generate` doesn't handle cleanly), that's a one-off authorised incident; document it in the PR description with "referenced ADR 0002, authorised bypass" and CC this file.
