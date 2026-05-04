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
| Systems | **Concordia v0.4.0** (evidence-composition layer) + **Sanctuary Castle Architecture v1.2** (verdict-policy gateway) |
| Integration shape | Typed-reference: a Concordia attestation envelope carries a typed reference to a Foxbook leaf as supporting evidence. Sanctuary verdict-policy anchors on the typed reference. |
| Status | **Proposed** |
| Schema discussion | <DISCUSSION_URL> |
| Origin | [A2A Discussion #1803, eriknewton 2026-05-04T17:39Z](https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-13655678) |

Three-layer stack:

1. **Identity** — Foxbook (handle verification, RFC 9162 transparency log)
2. **Evidence** — Concordia v0.4.0 (#1734-shape attestation envelopes)
3. **Verdict** — Sanctuary Castle Architecture v1.2 (gateway-side policy enforcement)

The typed-reference shape under discussion at <DISCUSSION_URL>. Once consensus lands, [`docs/decisions/0009-typed-reference-schema-for-composition.md`](decisions/0009-typed-reference-schema-for-composition.md) ratifies the shape on the Foxbook side.

---

## Cross-implementation references (substrate-layer)

These aren't application-layer integrations but are load-bearing for the cross-impl reference cycle per [ADR 0006](decisions/0006-protocol-not-marketplace.md) §4:

| Reference | Status | Link |
|---|---|---|
| Harness aggregator (`evidence_provider`, `claim_type_layer: identity`) | Live | [`agentgraph.co/.well-known/interop-harness.json`](https://agentgraph.co/.well-known/interop-harness.json) |
| CTEF v0.3.1 byte-match (4/4 vectors) | Verified 2026-04-30 | [`ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md`](../ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md) (commit 9e392c5) |
| CTEF v0.3.2 `request_inheritance.request_hash` shares JCS (RFC 8785) canonicalization with Foxbook tl-leaf hashing — cross-layer canonicalization cohesion: identity-layer (Foxbook) and evidence-layer (CTEF) walk one canonical-bytes algorithm regardless of which layer's hash a verifier is checking. | In v0.4 punch-list | [A2A Discussion #1734](https://github.com/a2aproject/A2A/discussions/1734) |
| AgentGraph litepaper §1.8 (substrate-and-primitive layering) | Publishes 2026-05-12 | TBD post-publish |

---

## Adding an entry

If you're integrating Foxbook into your system:

1. Open a thread at the schema-discussion venue (typically `<DISCUSSION_URL>` for Concordia/Sanctuary-shape integrations, or a new Discussion in `cloakmaster/foxbook` for novel shapes).
2. Once your integration shape is agreed publicly, open a PR adding an entry to this file.
3. Update Status as the integration progresses (Proposed → Spec'd → Live).

Maintainer review on PRs: weeks, not days, under stable mode. Use `hello@foxbook.dev` for time-sensitive substantive discussion.
