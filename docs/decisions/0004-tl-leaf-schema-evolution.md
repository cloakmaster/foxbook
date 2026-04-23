# ADR 0004 — tl-leaf schema evolution: additive-only within v1.x, old scouts verify old leaves

**Number:** 0004
**Date:** 2026-04-23
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0001 (service-agnostic core), ADR 0002 (DB layer discipline), ADR 0003 (enums-as-schemas)

## Context

Day 5 pinned `schemas/tl-leaf.v1.json` with exactly one leaf shape — `agentKeyRegistration` — and enumerated the deferred shapes in the schema `description`: `claim-event` (Day 5, deferred), `key-rotation` + `revocation` (Day 6–7), `manifest-version-diff` (week 2+), firehose events (never — those live in `firehose_events`, not in `tl_leaves`). Day 6 introduces revocation: the first real test of how the transparency-log schema evolves.

The Merkle transparency log is **append-only by design** — a leaf written at index N always keeps its original bytes, and every existing inclusion proof must continue to verify forever. Any schema evolution that changes the shape of a previously-written leaf breaks every scout that validated the old leaf before the change. This ADR pins the evolution rule so Day-6's revocation addition, Day-7's claim-event addition, and week-2's key-rotation addition all follow the same discipline.

## Decision

### 1. Additive-only changes stay within `tl-leaf.v1.json`

Adding a new `$defs` entry (`$defs/revocation` next to `$defs/agentKeyRegistration`) and expanding the top-level `oneOf` to include it is **additive** — a v1-valid old leaf still validates, a new v1-valid new leaf also validates. This is a v1 in-place evolution, not a new schema file.

Allowed additive changes:
- New `$defs` entry + new `oneOf` branch.
- New optional field inside an existing `$defs` entry.
- Loosening a constraint that was previously strict (e.g. `minLength: 8` → `minLength: 1`) — but see §3.

Disallowed within v1:
- Removing a `$defs` entry.
- Removing a field from an existing `$defs` entry.
- Tightening a constraint (e.g. new required field on an existing shape) — old leaves written before the tightening would no longer validate.
- Renaming a field (drop-plus-add from the perspective of old leaves).

### 2. Breaking changes require a v2 schema file

If a breaking change is genuinely needed (disallowed in §1), ship it as a new schema file:

- New file: `schemas/tl-leaf.v2.json`
- New `$id`: `https://foxbook.dev/schemas/tl-leaf/v2.json`
- v1 remains at `tl-leaf.v1.json` with `$id` ending in `/v1.json` **forever**.
- The `transparency_log` table's STH-signing infrastructure tracks which schema version each leaf was validated against at write time — so v2 never silently re-validates v1 leaves.

Version suffix lives in the path (`/v1.json`, `/v2.json`), not in a query string or filename-internal version field. This mirrors the envelope schema (foundation §8.1.1) which uses the same discipline.

### 3. Old scouts must still verify old leaves — Merkle is append-only

An inclusion proof computed against the v1.0 tl-leaf shape MUST continue to verify after a v1.x additive bump. The proof's algorithm (RFC 9162) hashes the canonical leaf bytes, not the schema — so as long as the leaf bytes never change, the hash never changes, and scouts written against v1.0 validate forever.

This is a concrete invariant, not a soft goal:
- Schema bumps do NOT rewrite any existing row in `tl_leaves`.
- Schema bumps do NOT recompute any existing `transparency_log.root_hash`.
- Schema bumps do NOT invalidate any previously-issued STH.

### 4. Schema-revision tracking within v1

`schemas/tl-leaf.v1.json`'s `description` field carries a human-readable log of its additive revisions (e.g. "v1.0 — agent-key-registration only. v1.1 — adds revocation shape per ADR 0004 + Day-6 harness."). The `$id` does not change; the content evolves.

Scouts that need to know which additive revision was live at write time can cross-reference the leaf's `published_at` timestamp against a commit-history lookup on `schemas/tl-leaf.v1.json` — but this should be exceptional. The on-the-wire invariant is that every valid v1 leaf continues to validate against the current v1 schema.

### 5. Applies to every Foxbook-specific enum-oneOf schema

This rule is not specific to `tl-leaf.v1.json`. It applies to any `oneOf`-shaped taxonomy schema where values are written to an append-only store:

- `tl-leaf.v1.json` (Merkle log leaves — this ADR's primary subject).
- `envelope.v1.json` (firehose events — additive `event_type` values follow the same rule once the envelope is frozen per LOCKED.md week-1).
- Future schemas: claim-state transitions, verification-tier codes, etc.

## Enforcement

**Code review, not mechanical.** The discipline is specific enough that a reviewer catches it; a lint that distinguishes "additive" from "breaking" schema changes would be brittle.

- Schema-change PRs reference this ADR in the body (mirrors ADR 0002's rule 5 for DB migrations).
- The PR body spells out: "this change is additive (new `$defs` entry, no existing shapes touched)" OR "this change requires a v2 schema (old leaves remain v1-valid, new leaves v2-valid)". If the reviewer can't classify quickly, the change is too big.
- CODEOWNERS already routes `schemas/` + `docs/decisions/` to `@cloakmaster`.

**Tomorrow (if it ever gets gamed):** a CI check that diffs `schemas/tl-leaf.v1.json` across commits and refuses removals or tightenings. Not building that today — the review discipline is cheaper and the team is one person.

## Consequences

- Day-6 revocation adds `$defs/revocation` to `tl-leaf.v1.json` as an in-place additive change. No new file, no $id change. The schema's description gets updated to name the new shape.
- Every future Merkle leaf type (claim events, key rotations, manifest-version diffs) lands as an additive `$defs` entry. The v1 schema accumulates shapes over time.
- Breaking the schema (hypothetical) means running v1 + v2 in parallel for the deprecation window. We have no current plans for this; the additive discipline is designed to avoid it.
- Python + TypeScript verifiers never need to understand the full schema history — they validate against whichever schema version was live at leaf-write time (v1 for everything written before a v2 cutover).

## Alternatives considered

- **Bump $id to v1.1 / v1.2 / … on every additive change.** Rejected: URL churn, scout-side re-pointing costs, and the invariant that v1 leaves are v1-valid forever already handles forward-compat without renames.

- **Rewrite leaves on schema tightenings.** Rejected by the append-only invariant. Merkle log integrity depends on bytes being immutable.

- **Keep each leaf type in its own schema file (`schemas/tl-leaf-agent-key-registration.v1.json` + `schemas/tl-leaf-revocation.v1.json` + …).** Rejected: the `oneOf` at the top level is what lets the validator pick the right shape at validation time without the caller threading a type tag through. Splitting loses that.

- **Let Claude Code invent the evolution rule in PR-body prose.** Rejected explicitly in the Day-5 retro + Day-6 review: policy decisions made in individual PR bodies drift across PRs. This ADR is the single source of truth for every future tl-leaf schema bump.

## When this rule can be violated

Only via an ADR that supersedes 0004. Concrete scenarios that would warrant a new ADR:

1. RFC 9162 evolves (CT v3) with breaking changes to leaf-hash prefix bytes. We'd need a v2 schema + a v2 STH version + a migration window.
2. A regulatory constraint (GDPR takedown, legal order) requires excising a leaf. Merkle integrity makes this impossible in-place; the response is an ADR that defines a parallel "revocation-of-leaf" record.

## Verified

- `schemas/tl-leaf.v1.json` exists with `agent-key-registration` as the only v0 shape (PR #9).
- First additive evolution (Day-6 revocation) applies this ADR. The PR body will reference it explicitly.
