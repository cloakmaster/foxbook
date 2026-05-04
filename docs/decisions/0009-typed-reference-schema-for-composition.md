# ADR 0009 — Typed-reference schema for composition (Foxbook ↔ Concordia ↔ Sanctuary)

**Number:** 0009
**Date:** 2026-05-04
**Status:** under-public-discussion
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0004 (tl-leaf schema evolution), ADR 0005 (canonical bytes once), ADR 0006 (protocol-not-marketplace), ADR 0008 (stable-mode maintenance posture)

## Context

[A2A Discussion #1803](https://github.com/a2aproject/A2A/discussions/1803) crystallized a three-layer substrate stack with concrete cross-implementation reference candidates:

- **Identity** — Foxbook (transparency log)
- **Evidence** — Concordia v0.4.0 (attestation envelopes)
- **Verdict** — Sanctuary Castle Architecture v1.2 (gateway policy)

[@eriknewton's 2026-05-04 comment](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-13655678) proposed the natural integration: a Concordia envelope carries a **typed reference** to a Foxbook leaf, which Sanctuary's verdict-layer anchors on. This composition uses Foxbook's *existing* surface — no Foxbook protocol changes required — so it composes cleanly with [ADR 0008](0008-stable-mode-maintenance-posture.md)'s feature freeze.

Specifying the typed-reference shape is a **composition decision** that affects multiple implementations. Per [ADR 0006](0006-protocol-not-marketplace.md)'s protocol-not-marketplace stance, the spec belongs in the open: reviewable, archival, multi-party. The active spec venue is:

**`<DISCUSSION_URL>`**

This ADR is the Foxbook-side ratification record. It is **`under-public-discussion`** until consensus lands in the thread; once schema v1.0 is agreed, this ADR is updated **in-place** with the ratified shape and `Status: accepted`. A new ADR (0010) is not opened for the ratification — the thread is the discussion record, this ADR is the decision record.

## Decision

### Schema (placeholder pending public consensus)

The strawman from `<DISCUSSION_URL>` is reproduced here for traceability. The ratified schema lands in this section once the thread reaches consensus.

```json
{
  "tl_url": "https://transparency.foxbook.dev",
  "leaf_index": 42,
  "tl_leaf_canonical_hash": "<64-char lowercase hex SHA-256>",
  "verified_signing_key_hex": "<64-char lowercase hex Ed25519 public key>",

  "sth_at_verify_time": {
    "tree_size": 100,
    "root_hash": "<64-char lowercase hex>",
    "timestamp": "<ISO-8601>"
  },
  "sth_signature": "<compact-JWS EdDSA, three base64url segments>"
}
```

Required: `tl_url`, `leaf_index`, `tl_leaf_canonical_hash`, `verified_signing_key_hex`. Optional: `sth_at_verify_time`, `sth_signature`. Versioning + evolution rules per [ADR 0004](0004-tl-leaf-schema-evolution.md) precedent (additive within v1.x; breaking changes to v2.0).

### Why these fields

- **`tl_url`** — explicit log identifier. Forward-compat with multi-vendor federated logs.
- **`leaf_index`** — log position. Combined with `tl_url`, uniquely identifies the leaf.
- **`tl_leaf_canonical_hash`** — load-bearing for log-fork detection. The verdict layer recomputes the SHA-256 of the canonical-bytes leaf preimage and compares; any divergence is a log-integrity violation. Per [ADR 0005](0005-canonical-on-both-sides.md), canonicalization is via `canonical.ts` on the raw object — never on a storage round-trip.
- **`verified_signing_key_hex`** — the active Ed25519 signing key surfaced by Foxbook SDK v0.2.0's `verifyAgentCard`. The verdict-layer uses this to verify the AgentCard's JWS signature directly without a second by-handle lookup.
- **`sth_at_verify_time` / `sth_signature`** — temporal anchor + offline verification. Optional because verdict-layers that always re-fetch live can ignore them; mandatory-ish for verdict-layers wanting offline / point-in-time semantics.

### What this ADR does NOT decide

- **Verdict-layer policy**. How Sanctuary (or any verdict-layer impl) handles staleness, revocation between assert-time and consume-time, signing-key rotation between assert-time and consume-time — out of scope. The typed-reference is rich enough to support strict-freshness, point-in-time-anchor, and hybrid policies; the verdict-layer chooses based on its threat model.
- **Concordia envelope shape**. How the typed reference embeds inside a Concordia attestation envelope (peer field vs nested vs CTEF-shape) is Concordia's call.
- **AgentCard JWS verification**. The typed reference asserts "this signing key was active at verify-time per Foxbook"; whether the AgentCard was JWS-signed with that key is a Sanctuary-side check, not encoded in the typed reference.

These deliberate omissions keep the typed reference minimal + composable. Adding them would couple it to specific verdict-layer or evidence-layer choices.

## Enforcement

- Schema-bump PRs to update this ADR's content (post-consensus) reference the discussion thread in the PR body and link the specific comment(s) where consensus crystallized.
- This ADR moves from `under-public-discussion` → `accepted` only when:
  - The discussion thread has explicit consensus from at least the Foxbook side and the Concordia/Sanctuary side (eriknewton).
  - The schema is reproduced verbatim in the "Decision" section above (replacing the strawman).
  - At least one reference implementation (Concordia v0.5.x or equivalent) has demonstrated the typed reference round-trips cleanly against a live Foxbook leaf.
- Schema evolution post-acceptance follows ADR 0004 precedent: additive within v1.x lands as inline updates here; breaking changes require a v2.0 schema and a new ADR (likely 0010+) explaining the migration.

## Consequences

- **Foxbook protocol surface is unchanged**. ADR 0008's feature freeze is preserved. Foxbook's existing tl-leaf v1.2 + SDK v0.2.0 expose everything the typed reference needs.
- **Cross-implementation reference cycle is materially strengthened**. Per [ADR 0006](0006-protocol-not-marketplace.md) §4, named cross-impl references are the load-bearing co-option-defense indicator. Concordia + Sanctuary citing Foxbook by name + canonical-bytes shape is exactly that.
- **The catalog at [`docs/INTEGRATIONS.md`](../INTEGRATIONS.md) tracks active compositions**. The Concordia + Sanctuary entry is the first; future compositions follow the same pattern.
- **`docs/COMPOSE-WITH-FOXBOOK.md`** is the path-of-engagement for future integrators. Points at this ADR + the active discussion thread.

## Alternatives considered

- **Spec offline between Foxbook and Concordia/Sanctuary maintainers**. Considered briefly (per cloakmaster's 2026-05-04T17:47Z reply on #1803) but rejected in favor of public spec — reviewable, archival, multi-party, and consistent with ADR 0006's protocol-not-marketplace stance.
- **Embed full leaf bytes in the typed reference**. Rejected: increases receipt size + couples consumers to leaf-shape changes. The hash-pointer pattern (citing `tl_leaf_canonical_hash` and resolving via `tl_url + leaf_index`) is more durable.
- **Skip `tl_leaf_canonical_hash`; trust the live log**. Rejected: removes the ability to detect log forks at receipt-consumption time. The verdict-layer can re-fetch the live leaf; comparing its hash against the typed reference's hash is the integrity check.
- **Make `sth_at_verify_time` + `sth_signature` required**. Rejected (for v1.0): pushes complexity onto integrators that don't need offline / temporal-anchor semantics. May be promoted in v2.0 if practice shows the optional path is rarely chosen.

## When this rule can be violated

ADR 0009 itself can be amended in-place pre-acceptance (the strawman evolves with the thread). Post-acceptance, schema evolution follows ADR 0004 precedent (additive within v1.x; breaking changes to v2.0 + a new ADR).

The composition pattern itself (typed-reference, embedded inside a higher-layer envelope) can be superseded by a different composition pattern in a future ADR (0010+) if the cross-impl group decides a different shape is structurally better. ADR 0009 is silent on whether typed-reference is the only valid composition shape — see `docs/COMPOSE-WITH-FOXBOOK.md` for other shapes (wrapping, referencing-without-embedding, direct API integration).

## Verified

- The strawman schema in this ADR matches the strawman posted at `<DISCUSSION_URL>` first-comment as of `<DATE_POSTED>`.
- Foxbook SDK v0.2.0 (`@foxbook/sdk-claim@0.2.0`) surfaces `verified_signing_key_hex` + `leaf_index` on the `verified` branch of `verifyAgentCard`. Verified by `npm view @foxbook/sdk-claim`.
- tl-leaf v1.2's canonical-bytes shape (per [ADR 0004 addendum-3](0004-tl-leaf-schema-evolution.md)) is what `tl_leaf_canonical_hash` references. Cross-language byte-match validation in [`schemas/crypto-test-vectors.json`](../../schemas/crypto-test-vectors.json).
- Concordia v0.4.0 and Sanctuary Castle Architecture v1.2 are the named cross-impl reference candidates per [@eriknewton's 2026-05-04 comment](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-13655678) on A2A Discussion #1803.
