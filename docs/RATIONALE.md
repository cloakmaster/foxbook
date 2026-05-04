# Why Foxbook is shaped the way it is

This document is the narrative summary for someone discovering Foxbook for the first time and wondering why the architectural choices look like they do. The authoritative records are the eight ADRs in [`docs/decisions/`](decisions/); this is the human-readable index over them.

## The primitive

Foxbook is one thing: a verifiable identity primitive for agents. An agent's published manifest (an A2A AgentCard, or analogous shape for MCP) declares a `handle` — `@somebody`, `did:foxbook:{ULID}`, a domain. A receiving agent has no cryptographic basis for trusting that declaration on its own. Foxbook's answer is a public RFC 9162-shaped Merkle transparency log: claims are leaves, recovery-key-signed revocations are leaves, the whole structure is append-only and independently verifiable. `verifyAgentCard(card)` returns one of four discriminated outcomes — `verified`, `unverified`, `handle-mismatch`, `stale-proof` — and that's the entire verification surface.

The shape is deliberate: cryptographic so claims can't be forged, public so anyone can audit without asking permission, free so adoption isn't gated on commercial relationships. RFC 9162 has been the model for TLS certificates for ten years; Foxbook is that pattern applied to agent identity.

## Why the architecture chose what it chose

### Code that doesn't depend on any specific service (ADR 0001)

The transparency-log core, canonicalization, and Merkle primitives sit in `core/` and `packages/` with no imports from external service adapters. A scout running their own log against the same protocol contracts can take any of these packages, drop them in a different host shape, and still produce byte-identical canonical output. The discipline is enforced by `pnpm check:core-isolation` — a regression there blocks merge.

The reason is forward optionality. If a future federated deployment uses different storage, a different cloud, or a different language entirely, the protocol contracts still hold because the canonicalization + Merkle code never coupled to a specific service.

### Forward-only schema migrations (ADR 0002)

Database migrations are append-only. No `DROP COLUMN` rolls. The reason is operational: a transparency log is only useful if its history is intact, and intact history requires schema history that's compatible all the way back. ADR 0002 forbids destructive migrations and routes the migration boundary through the maintainer's terminal so an agent doesn't accidentally rewrite history.

### Foxbook-specific enums live in JSON Schema, not in code (ADR 0003)

Anywhere there's a Foxbook-specific enum (asset types, leaf types, claim states, revocation reason codes), the canonical declaration lives in `schemas/*.json`. TypeScript and Python types are *generated* from the schema, not hand-maintained alongside it. Drift between the two is impossible by construction — `pnpm check:generated` catches any uncommitted regen.

The reason is multi-language interop. Cross-implementation byte-match validation requires that "what is a leaf type" has one canonical definition, not three definitions in three languages that drift over time. The schema is the source of truth.

### Append-only schema evolution within v1 (ADR 0004 + addenda)

`schemas/tl-leaf.v1.json` is the taxonomy of leaf shapes that get written to the transparency log. ADR 0004 pins the rule: schema changes within v1 must be additive (new `$defs` entries, new `oneOf` branches, new optional fields) so old leaves continue to validate against the current schema forever. Removing or renaming fields requires a v2 schema with a new `$id`.

Three concrete additions land via this rule: revocation (addendum 1, Day 6), the firehose emission pattern (addendum 2, Day 6 PR D), and the signing-key-registration rotation shape (addendum 3, Day 10). All three are additive; old leaves still validate.

The reason is RFC 9162 invariant preservation. An inclusion proof computed against a Day-5 leaf must still verify after a Day-100 schema bump, or the transparency-log contract is broken. ADR 0004 makes that invariant durable architectural policy rather than a per-PR review concern.

### Canonical bytes are computed once, never re-derived from storage (ADR 0005)

When something is hashed or signed, the canonical bytes come from the raw object as constructed in memory — never from a Postgres `jsonb` round-trip, never from a CBOR decode, never from any storage layer's serialization. Storage layers lose byte-identity by design (Postgres reorders jsonb keys); recomputing a hash from a storage decode produces different bytes than the original.

This rule is the reason `tl_leaves.leaf_hash` is stored as a separate column at write time. Read paths read the stored hash. They don't recompute it.

### Protocol-not-marketplace, with co-option as the failure mode (ADR 0006)

This is the strategic frame. Foxbook is shipped as a protocol primitive — open spec, open code, open canonical bytes, anyone can implement and verify against any deployment. The path-asymmetry is unconditional: protocol-now leaves marketplace-later open, but marketplace-now closes protocol-ever. Foxbook ships protocol-now.

The failure mode for an Apache 2.0 transparency-log primitive isn't a hostile fork (forks under different names are a feature). It's co-option: a larger entity adopts the spec while blunting the open-protocol guarantees — proprietary verification logic, undocumented schema extensions, "Foxbook-compatible" managed services that customers can't audit. The defense is cross-implementation references that name the canonical impl: harness aggregator entries, byte-match validation reports, citations in other specs. Each cross-impl reference raises the cost of co-option.

A forward-looking instance of this pattern: CTEF v0.3.2 §A Conformance Appendix (publish window ~2026-05-20) lists Foxbook as one of 6 reproducibility receipts spanning 8 byte-match-validated implementations + 8 independent canonicalizers — Foxbook's receipt: 4/4 byte-match via independent `canonicalize@2.1.0` (erdtman RFC 8785 reference impl); reproducibility-without-maintainer-rerun is the appendix's normative MUST. (Citation URL added once v0.3.2 publishes.)

The Apache 2.0 license + Foxbook trademark split (per [TRADEMARK.md](../TRADEMARK.md)) is the brand-layer expression of this rule. Anyone can fork the code; using the **Foxbook** name in association with a derived service requires written permission. This is the same shape as Linux + Linux trademark, PostgreSQL + PostgreSQL trademark.

### HTTP cache policy + read/write split (ADR 0007)

Read endpoints set `Cache-Control: public, max-age=60, must-revalidate`; immutable artifacts (per-leaf, per-inclusion-proof, per-consistency-proof) use `max-age=31536000, immutable`; STH (`/root`) uses `no-store`. The read-side (Cloudflare Worker at `transparency.foxbook.dev`) and write-side (Fly.io at `api.foxbook.dev`) are permanently separate deployments — standard transparency-log infrastructure pattern. List-shaped endpoints, if they ever ship, use cursor-based pagination; never offset.

The reason is operational scaling shape. Read traffic scales via edge cache without touching the write path; write traffic scales via Postgres region replication without touching the read path. Merging them later is forbidden by this ADR.

### Stable mode (ADR 0008)

Ten days of focused build closed with public commitments shipped, the harness aggregator entry registered, and zero pull from outside (0 stars, 7 unique repo viewers in 14 days, 5 organic npm downloads on the day after launch). The honest call: substrate strategies compound passively over years; the maintainer's marginal forward hour is allocated elsewhere. Foxbook enters stable / maintenance mode.

This is not abandonment. The substrate continues to compound: the harness aggregator entry is permanent until upstream changes, the SDK on npm is permanent under semver, the live deployments stay live with best-effort SLA. A future user discovering Foxbook in 6–24 months can adopt cleanly via:

1. Find Foxbook via the harness aggregator entry or kenneives's AgentGraph litepaper §1.8 cross-reference (publishing 2026-05-12).
2. Read this RATIONALE.md and understand why Foxbook exists.
3. Follow [`docs/VERIFY-IN-60-SECONDS.md`](VERIFY-IN-60-SECONDS.md) and verify a live agent card.
4. `npm install @foxbook/sdk-claim` and integrate.
5. Email `hello@foxbook.dev` for production support contact.

Active development resumes via a future ADR that explicitly supersedes 0008 — typically triggered by external integration signal, regulatory forcing function, or a future maintainer taking over.

## What's deliberately not here

- **No marketplace shape** (per ADR 0006). No per-call billing, no account hierarchies, no closed-source verification logic.
- **No reputation or trust score** in the verification result. Verification is objective and cryptographic; reputation is subjective and lives in a layer above this primitive. The four-outcome discriminated result (`verified`, `unverified`, `handle-mismatch`, `stale-proof`) is the entire verification surface. No numeric trust score in any branch.
- **No vendor lock-in mechanisms**. Apache 2.0 is the license; the spec is the standard; the host is not load-bearing.
- **No active feature roadmap** (per ADR 0008). Stable mode is the posture.

## Where to go next

- [`docs/VERIFY-IN-60-SECONDS.md`](VERIFY-IN-60-SECONDS.md) — verify a live agent card from a fresh shell.
- [`docs/decisions/`](decisions/) — full ADRs 0001–0008.
- [`docs/rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) — the spec in RFC form.
- `https://transparency.foxbook.dev/` — the live transparency log read endpoints.
- `https://agentgraph.co/.well-known/interop-harness.json` — cross-impl harness registration.
