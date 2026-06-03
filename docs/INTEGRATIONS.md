# Active integrations

Living index of known compositions where another system embeds, references, or otherwise composes against Foxbook's transparency-log primitive. Foxbook is in [stable / maintenance mode](decisions/0008-stable-mode-maintenance-posture.md) per ADR 0008; new integrations are welcome and tracked here, but Foxbook's own protocol surface is frozen at v0.2.

If you're integrating, see [`COMPOSE-WITH-FOXBOOK.md`](COMPOSE-WITH-FOXBOOK.md) for the engagement path. This page is the catalog.

## Status legend

- **Proposed** — integration shape under discussion. Schema not yet ratified.
- **Spec'd** — typed-reference schema agreed; implementations may be in progress.
- **Live** — integration is shipping in production with at least one observed dispatch.
- **Archived** — integration retired or superseded.

---

## Concordia ↔ Foxbook ↔ Sanctuary

| Field | Value |
|---|---|
| Integrator | [@eriknewton](https://github.com/eriknewton) |
| Systems | **Concordia v0.5** (evidence-composition layer; v0.5 ships the `references[]` extension) + **Sanctuary Castle Architecture v1.3+** (verdict-policy gateway; Foxbook-by-handle verifier as a Castle Layer 3 surface) |
| Integration shape | Typed-reference v1.0 per [ADR 0009](decisions/0009-typed-reference-schema-for-composition.md): a Concordia attestation envelope carries a typed reference to a Foxbook leaf as supporting evidence inside its `references[]` array. Sanctuary verdict-policy anchors on the typed reference. |
| Status | **Concordia (evidence) leg: Live** — Concordia v0.5.1 shipped to PyPI 2026-05-11, exercising the typed-reference pattern per Concordia SPEC §11.5 ([eriknewton 2026-05-13](https://github.com/cloakmaster/foxbook/discussions/73#discussioncomment-16907475)). **Sanctuary (verdict) leg: Spec'd (queued)** — v1.3+ Foxbook-by-handle verifier pending the v1.3.0-rc.1 cut. |
| Schema | [ADR 0009](decisions/0009-typed-reference-schema-for-composition.md) (ratified 2026-05-08); JSON Schema artifact at [`schemas/typed-reference.v1.json`](../schemas/typed-reference.v1.json) |
| Consensus venue | [Discussion #73](https://github.com/cloakmaster/foxbook/discussions/73) (ratified by [eriknewton 2026-05-07T20:42Z](https://github.com/cloakmaster/foxbook/discussions/73#discussioncomment-16834540)) |
| Origin | [A2A Discussion #1803, eriknewton 2026-05-04T17:39Z](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-13655678) |

Three-layer stack:

1. **Identity** — Foxbook (handle verification, RFC 9162 transparency log)
2. **Evidence** — Concordia v0.5 (#1734-shape attestation envelopes; carries typed-reference v1.0 inside `references[]`)
3. **Verdict** — Sanctuary Castle Architecture v1.3+ (gateway-side policy enforcement; Foxbook-by-handle verifier as Cooperative MCP capability)

Concordia leg flipped Spec'd → Live on 2026-05-11 (Concordia v0.5.1 on PyPI ships the `references[]` consumption surface per SPEC §11.5). Sanctuary leg flips Spec'd → Live when Sanctuary v1.3+ ships the Foxbook-by-handle verifier (pending the v1.3.0-rc.1 cut; cut decision landed 2026-05-13).

---

## AlgoVoi ↔ Foxbook

| Field | Value |
|---|---|
| Integrator | [@chopmob-cloud](https://github.com/chopmob-cloud) (AlgoVoi) |
| Systems | **AlgoVoi** settlement + compliance / reputation layers (`/compliance/screen`, `/compliance/attestation`, x402 / MPP / AP2 payment rails) composing above Foxbook identity; **Verascore** `PAYMENT_SETTLEMENT` attestations consume the identity binding |
| Integration shape | Typed-reference v1.0 per [ADR 0009](decisions/0009-typed-reference-schema-for-composition.md): an AlgoVoi `PAYMENT_SETTLEMENT` / `evidence_provider.identity_reference` carries a typed reference (`type: "foxbook:leaf-v1"`, `typed_reference_version: "1.0"`, `tl_leaf_canonical_hash` — the RFC 9162 leaf hash, JCS / RFC 8785 over leaf-7's structured fields) back to a Foxbook leaf, proving the payer's identity was Foxbook-verified at settlement time. Discriminator owned at the Concordia v0.5.1 §11.5 envelope `references[].type` (not inside the typed-reference schema); payload nested under it. Negative-path matrix: `foxbook_unverified` / `foxbook_handle_mismatch` / `foxbook_stale_proof` (fail-closed). |
| Production anchor | `did:web:api.algovoi.co.uk` ([`/.well-known/did.json`](https://api.algovoi.co.uk/.well-known/did.json), 7-entry `service[]` + `verificationMethod`) — multi-DID composition with `did:foxbook:01KRXTMK3Z20J7V7MMD17W6T59` (leaf 7) and `did:key:z6MkgExzvcpvxrghf4Q3285xqSdenhRZHcP6wc5UvY6VVaz5` (Verascore signer) |
| Identity binding | `did:foxbook:01KRXTMK3Z20J7V7MMD17W6T59` = tier 1, leaf 7, with the dereferenceable `FoxbookTransparencyLog` inclusion proof at the `/inclusion/7` surface; live leaf view at [`/leaf/7`](https://transparency.foxbook.dev/leaf/7) |
| Status | **Live** |
| Schema | [ADR 0009](decisions/0009-typed-reference-schema-for-composition.md) (accepted 2026-05-08); JSON Schema artifact at [`schemas/typed-reference.v1.json`](../schemas/typed-reference.v1.json) |
| Consensus venue | [Discussion #79](https://github.com/cloakmaster/foxbook/discussions/79) (72h cross-impl review window 2026-05-18T15:55Z → ~2026-05-21T15:55Z; substrate-layer review by kenneives 2026-05-18T19:52Z, live-in-production confirmed by chopmob-cloud 2026-05-19T08:55Z) |
| Origin | [A2A Discussion #1803, cloakmaster 2026-05-18](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-16963733) |

Three-layer composition (per the AlgoVoi call sequence in #79): Foxbook owns identity (leaf 7 + transparency-log inclusion); AlgoVoi owns policy + settlement + compliance posture; Verascore owns composite reputation. The substrate-layer cross-reference row and the `foxbook × algovoi-proxy-chain` cross-extension fixture-matrix row (structural-identity `urn:foxbook:leaf:7` surface, per A2A #1734) remain queued behind the AlgoVoi conformance PRs at [aeoess/aps-conformance-suite#5](https://github.com/aeoess/aps-conformance-suite/pull/5).

---

## Cross-implementation references (substrate-layer)

These aren't application-layer integrations but are load-bearing for the cross-impl reference cycle per [ADR 0006](decisions/0006-protocol-not-marketplace.md) §4:

| Reference | Status | Link |
|---|---|---|
| Harness aggregator (`evidence_provider`, `claim_type_layer: identity`) | Live | [`agentgraph.co/.well-known/interop-harness.json`](https://agentgraph.co/.well-known/interop-harness.json) |
| CTEF v0.3.1 byte-match (4/4 vectors) | Verified 2026-04-30 | [`ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md`](../ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md) (commit 9e392c5) |
| CTEF v0.3.2 `request_inheritance.request_hash` shares JCS (RFC 8785) canonicalization with Foxbook tl-leaf hashing — cross-layer canonicalization cohesion: identity-layer (Foxbook) and evidence-layer (CTEF) walk one canonical-bytes algorithm regardless of which layer's hash a verifier is checking. | In v0.4 punch-list | [A2A Discussion #1734](https://github.com/a2aproject/A2A/discussions/1734) |
| AgentGraph litepaper §1.8 (substrate-and-primitive layering) | Publishes 2026-05-12 | TBD post-publish |
| Symmetric `docs/COMPOSE-WITH-SANCTUARY.md` on the Sanctuary side | Queued (per eriknewton 2026-05-07) | TBD post-publish |

---

## Adding an entry

If you're integrating Foxbook into your system:

1. Open a thread at the schema-discussion venue (typically https://github.com/cloakmaster/foxbook/discussions/73 for Concordia/Sanctuary-shape integrations, or a new Discussion in `cloakmaster/foxbook` for novel shapes).
2. Once your integration shape is agreed publicly, open a PR adding an entry to this file.
3. Update Status as the integration progresses (Proposed → Spec'd → Live).

Maintainer review on PRs: weeks, not days, under stable mode. Use `hello@foxbook.dev` for time-sensitive substantive discussion.
