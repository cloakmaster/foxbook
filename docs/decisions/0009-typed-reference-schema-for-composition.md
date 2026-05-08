# ADR 0009 — Typed-reference schema for composition (Foxbook ↔ Concordia ↔ Sanctuary)

**Number:** 0009
**Date:** 2026-05-04 (opened); 2026-05-08 (ratified at v1.0)
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0004 (tl-leaf schema evolution), ADR 0005 (canonical bytes once), ADR 0006 (protocol-not-marketplace), ADR 0008 (stable-mode maintenance posture)

## Context

[A2A Discussion #1803](https://github.com/a2aproject/A2A/discussions/1803) crystallized a three-layer substrate stack with concrete cross-implementation reference candidates:

- **Identity** — Foxbook (transparency log)
- **Evidence** — Concordia v0.4.0 (attestation envelopes)
- **Verdict** — Sanctuary Castle Architecture v1.2 (gateway policy)

[@eriknewton's 2026-05-04 comment](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-13655678) proposed the natural integration: a Concordia envelope carries a **typed reference** to a Foxbook leaf, which Sanctuary's verdict-layer anchors on. This composition uses Foxbook's *existing* surface — no Foxbook protocol changes required — so it composes cleanly with [ADR 0008](0008-stable-mode-maintenance-posture.md)'s feature freeze.

Specifying the typed-reference shape is a **composition decision** that affects multiple implementations. Per [ADR 0006](0006-protocol-not-marketplace.md)'s protocol-not-marketplace stance, the spec belongs in the open: reviewable, archival, multi-party. The active spec venue was:

**https://github.com/cloakmaster/foxbook/discussions/73**

The thread reached consensus on 2026-05-08 (eriknewton's ratification comment after the 72h ratification window opened in cloakmaster's round-2 reply). This ADR is the Foxbook-side ratification record: now `accepted`, with the v1.0 schema content below replacing the original strawman in-place. No 0010 was opened for ratification — the thread is the discussion record, this ADR is the decision record.

## Decision

### Schema (v1.0, ratified)

```json
{
  "typed_reference_version": "1.0",
  "tl_url": "https://transparency.foxbook.dev",
  "leaf_index": 42,
  "tl_leaf_canonical_hash": "<64-char lowercase hex>",
  "verified_signing_key_hex": "<64-char lowercase hex>",
  "sth_at_verify_time": {
    "tree_size": 100,
    "root_hash": "<64-char lowercase hex>",
    "timestamp": "<ISO-8601>"
  },
  "sth_signature": "<compact-JWS, 3 base64url segments>"
}
```

**Required**: `typed_reference_version`, `tl_url`, `leaf_index`, `tl_leaf_canonical_hash`, `verified_signing_key_hex`. **Optional**: `sth_at_verify_time`, `sth_signature`.

### Field spec

- **`typed_reference_version`** *(string, required)*. Schema version. Currently `"1.0"`. Evolution per [ADR 0004](0004-tl-leaf-schema-evolution.md) precedent: additive within v1.x (new optional fields OK, no version bump); breaking changes (remove field, rename field, tighten constraint) require `2.0`. The field is **in-band** — inside the typed reference itself, not in the containing envelope's context — so future implementations that don't share envelope context, or that read archived receipts from older envelope versions, can parse the typed reference standalone.

- **`tl_url`** *(URL, required)*. Base URL of the transparency log carrying the leaf. Verifiers resolve `${tl_url}/inclusion/${leaf_index}` and `${tl_url}/leaf/${leaf_index}` against this base.

- **`leaf_index`** *(integer ≥ 0, required)*. Position of the leaf in the log. Combined with `tl_url`, uniquely identifies the leaf.

- **`tl_leaf_canonical_hash`** *(64-char lowercase hex, required)*. RFC 9162 leaf hash of the leaf at `leaf_index`. Lets verifiers detect log forks by recomputing from the live leaf and comparing. A mismatch is a log-integrity violation or a falsified typed reference; either way: reject. Per [ADR 0005](0005-canonical-on-both-sides.md), Foxbook's canonical-bytes algorithm is the source-of-truth for this hash on the producing side; verifiers can either use Foxbook's [`@foxbook/sdk-claim`](https://www.npmjs.com/package/@foxbook/sdk-claim) or implement against the RFC 9162 leaf-hash convention from primitives.

- **`verified_signing_key_hex`** *(64-char lowercase hex, required)*. **A fact about Foxbook's log state at the moment `foxbookVerify` returned — specifically, the active signing key registered for this DID. It is NOT a claim that any specific AgentCard JWS was verified against this key. AgentCard signature verification is the verdict layer's responsibility; the typed reference provides the key bytes the verdict layer needs to do that verification, nothing more.** This phrasing is load-bearing: it pins the policy boundary where it belongs (typed reference = facts about Foxbook log state; verdict policy = decisions about what those facts mean for a specific receipt).

- **`sth_at_verify_time`** *(object, optional)*. Shape: `{tree_size, root_hash, timestamp}`. The Signed Tree Head observed at verify-time. Anchors temporal context + enables Merkle-root reconstruction without re-fetching the live `/root`.

- **`sth_signature`** *(compact-JWS, optional)*. EdDSA signature over the STH content. Lets verdict layers authenticate the STH offline without trusting the integrator. Cross-checks against `sth_at_verify_time` catch typed-reference falsification at two independent points.

### Optionality + versioning rules

- **v1.0**: `sth_at_verify_time` + `sth_signature` are **optional**. Verdict layers wanting offline-verifiable receipts **SHOULD** prefer typed references with both populated. Soft directional signal — not a `MUST`; doesn't gate adoption. Lower activation energy for early integrators wins.
- **v2.0**: both fields become **required**. The optional-deprecated phase in v1.0 is the migration path to required-by-default offline-verifiability semantics.
- **Multi-log federation** (multiple `tl_url`s with cross-log consensus) is deferred to v2.0 with an additive `federated_logs` field. v1.0 stays single-log; single-log v1.0 receipts remain parseable in v2.0 readers; v2.0 receipts that use `federated_logs` are not parseable in v1.0 readers (strict superset).

### What this ADR does NOT decide

- **Verdict-layer policy**. How Sanctuary (or any verdict-layer impl) handles staleness, revocation between assert-time and consume-time, signing-key rotation between assert-time and consume-time — out of scope. The typed-reference is rich enough to support strict-freshness, point-in-time-anchor, and hybrid policies; the verdict-layer chooses based on its threat model.
- **Concordia envelope shape — the `references[]` entry shape**. How the typed reference embeds inside a Concordia attestation envelope (entry-shape inside `references[]`, type-discriminator field name, version-of-version handling at the envelope-vs-typed-ref layer) is **Concordia's spec to define, not Foxbook's**. Per the consensus reached on [Discussion #73](https://github.com/cloakmaster/foxbook/discussions/73), CTEF-inside Concordia's `references[]` is the canonical container for cross-vendor evidence references; the typed reference itself is container-agnostic and portable across any future evidence-layer envelope shape.
- **AgentCard JWS verification**. The typed reference asserts "this signing key was active at verify-time per Foxbook"; whether the AgentCard was JWS-signed with that key is a Sanctuary-side check, not encoded in the typed reference.

These deliberate omissions keep the typed reference minimal + composable. Adding them would couple it to specific verdict-layer or evidence-layer choices.

## Consensus venue (load-bearing)

The v1.0 schema was ratified through public discussion at [https://github.com/cloakmaster/foxbook/discussions/73](https://github.com/cloakmaster/foxbook/discussions/73). Specific load-bearing comments:

- **Strawman opener** (cloakmaster, 2026-05-04T19:56:29Z): `cloakmaster/foxbook#73` first comment — initial v1.0 strawman + five open questions + three negative-path scenarios.
- **Substantive answers** (eriknewton, 2026-05-05T05:04:37Z): walked all five open questions with concrete positions (CTEF-inside, optional-then-required, weaker semantic, in-band version, defer multi-log to v2.0).
- **Round-2 final-form** (cloakmaster, 2026-05-05T15:46:30Z): final-form v1.0 schema with the three Foxbook-side refinements applied (consumer-policy guidance for Q2, explicit weaker-semantic phrasing for Q3, `typed_reference_version` for Q4); 72h ratification window opened; container deliberately deferred to Concordia.
- **Cross-impl ratification** (eriknewton, 2026-05-07T20:42:42Z): "Ratifying the v1.0 typed-reference schema from my side. The five Q answers hold as posted: CTEF-inside, optional-then-required, weaker semantic, in-band version, defer multi-log to v2.0."
- **Foxbook-side ratification** (this ADR update, 2026-05-08): status `under-public-discussion` → `accepted`; strawman replaced with v1.0 schema in-place.

Concrete forward commitments from the consensus venue:

- **Concordia v0.5** (eriknewton): `references[]` extension consuming the typed-reference shape per ADR 0009. Tracks the v0.5 release.
- **Sanctuary v1.3+** (eriknewton): Foxbook-by-handle verifier as a Castle Layer 3 surface. Composes with the rest of the Sanctuary verifier set.
- **Symmetric `docs/COMPOSE-WITH-SANCTUARY.md`** on the Sanctuary side (eriknewton): bidirectional discoverability for any third party reaching for the three-layer composition.

## Enforcement

- Schema-bump PRs to update this ADR's content (post-ratification, additive evolution within v1.x) reference [Discussion #73](https://github.com/cloakmaster/foxbook/discussions/73) (or its successor consensus venue) in the PR body and link the specific comments where the additive evolution was discussed.
- Schema evolution post-acceptance follows [ADR 0004](0004-tl-leaf-schema-evolution.md) precedent: additive within v1.x lands as inline updates here; breaking changes require a v2.0 schema and a new ADR (0010+) explaining the migration.
- The companion JSON Schema artifact at [`schemas/typed-reference.v1.json`](../../schemas/typed-reference.v1.json) is the machine-readable normative form of this schema — useful for envelope-side validation by Concordia and downstream consumers. Consumers MAY validate against either the JSON Schema artifact or the markdown spec above; both are equivalent for v1.0.

## Consequences

- **Foxbook protocol surface is unchanged.** ADR 0008's feature freeze is preserved. Foxbook's existing tl-leaf v1.2 + SDK v0.2.0 expose everything the typed reference needs — no Foxbook code changes required for the typed-reference v1.0 to compose with Concordia v0.5+ / Sanctuary v1.3+.
- **Cross-implementation reference cycle is materially strengthened.** Per [ADR 0006](0006-protocol-not-marketplace.md) §4, named cross-impl references are the load-bearing co-option-defense indicator. Concordia + Sanctuary citing Foxbook by name + canonical-bytes shape is exactly that.
- **The catalog at [`docs/INTEGRATIONS.md`](../INTEGRATIONS.md)** tracks active compositions. With ADR 0009 ratified, the Concordia + Sanctuary entry status flips **Proposed → Spec'd**. It flips **Spec'd → Live** when Concordia v0.5 / Sanctuary v1.3+ actually ship the typed-reference consumption surface.
- **`docs/COMPOSE-WITH-FOXBOOK.md`** is the path-of-engagement for future integrators wanting to compose against the typed reference. Other identity-layer / evidence-layer / verdict-layer implementations are welcome to file additive evolution requests against this ADR via Discussion #73 or new threads.

## Alternatives considered

- **Spec offline between Foxbook and Concordia/Sanctuary maintainers**. Considered briefly (per cloakmaster's 2026-05-04T17:47Z reply on #1803) but rejected in favor of public spec — reviewable, archival, multi-party, and consistent with ADR 0006's protocol-not-marketplace stance. The public-spec path produced consensus in one round of substantive exchange + one ratification round.
- **Embed full leaf bytes in the typed reference**. Rejected: increases receipt size + couples consumers to leaf-shape changes. The hash-pointer pattern (citing `tl_leaf_canonical_hash` and resolving via `tl_url + leaf_index`) is more durable.
- **Skip `tl_leaf_canonical_hash`; trust the live log**. Rejected: removes the ability to detect log forks at receipt-consumption time. The verdict-layer can re-fetch the live leaf; comparing its hash against the typed reference's hash is the integrity check that detects fork-class adversaries.
- **Make `sth_at_verify_time` + `sth_signature` required in v1.0**. Rejected (for v1.0): pushes complexity onto integrators that don't need offline / temporal-anchor semantics, raising activation energy at the worst possible moment (early adoption). Promoted to required in v2.0 via the optional-deprecated migration path.
- **Out-of-band version field** (e.g., versioning at the containing envelope's context). Rejected: breaks portability across different envelope shapes. The in-band `typed_reference_version` keeps the typed reference standalone-parseable.

## When this rule can be violated

The composition pattern itself (typed-reference, embedded inside a higher-layer envelope) can be superseded by a different composition pattern in a future ADR (0010+) if the cross-impl group decides a different shape is structurally better. ADR 0009 is silent on whether typed-reference is the only valid composition shape — see [`docs/COMPOSE-WITH-FOXBOOK.md`](../COMPOSE-WITH-FOXBOOK.md) for other shapes (wrapping, referencing-without-embedding, direct API integration).

Schema evolution within v1.x lands as inline updates to this ADR (additive only). Breaking changes require a v2.0 schema + a new ADR explaining the migration; the v1.0 schema continues to validate v1.0 receipts forever per the same ADR 0004 precedent that locks tl-leaf v1.x compatibility.

## Verified

- The v1.0 schema in this ADR matches the final-form schema posted at [Discussion #73, cloakmaster's round-2 comment 2026-05-05T15:46:30Z](https://github.com/cloakmaster/foxbook/discussions/73#discussioncomment-16818085) and ratified by [eriknewton's 2026-05-07T20:42:42Z comment](https://github.com/cloakmaster/foxbook/discussions/73#discussioncomment-16834540).
- Foxbook SDK v0.2.x (`@foxbook/sdk-claim` on npm) surfaces `verified_signing_key_hex` + `leaf_index` on the `verified` branch of `verifyAgentCard`. Verified by `npm view @foxbook/sdk-claim`.
- tl-leaf v1.2's canonical-bytes shape (per [ADR 0004 addendum-3](0004-tl-leaf-schema-evolution.md)) is what `tl_leaf_canonical_hash` references. Cross-language byte-match validation in [`schemas/crypto-test-vectors.json`](../../schemas/crypto-test-vectors.json) and [`schemas/merkle-test-vectors.json`](../../schemas/merkle-test-vectors.json).
- Worked example with running RFC 9162 verifier published as a public gist at https://gist.github.com/cloakmaster/0e07c1aed0c7cae61484a01762e6ed9b — fixture from leaf #6 of the live Foxbook log + ~80-line reference verifier that depends only on `@noble/curves` + `@noble/hashes`. Demonstrates downstream verification logic end-to-end.
- Concordia v0.4.0 and Sanctuary Castle Architecture v1.2 are the named cross-impl reference candidates per [@eriknewton's 2026-05-04 comment](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-13655678) on A2A Discussion #1803; v0.5 / v1.3+ commitments per the [2026-05-07 ratification comment](https://github.com/cloakmaster/foxbook/discussions/73#discussioncomment-16834540) on Discussion #73.
