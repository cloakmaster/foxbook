# Foxbook prior art — invention timeline

This page exists as a defensive artifact: a documented timeline establishing Foxbook's prior art on the verifiable-agent-identity-via-public-transparency-log primitive. Useful if any third party ever claims to have invented the same shape independently after Foxbook published it.

The repository's git history, npm publish dates, GitHub releases, JSON Schema files, and architectural decision records (ADRs) are the load-bearing evidence; this page is the human-readable index over them.

## Architecture

Foxbook's specific shape:

- **Public RFC 9162-shaped Merkle transparency log** for agent-identity claims (`tl-leaf` v1.x schema; `agent-key-registration` / `revocation` / `signing-key-registration` shapes; recovery-key-signed evolution)
- **Agent-owned ed25519 signing keys** (each agent controls its keypair; distinct from CI/CD-bound trust roots like Sigstore)
- **Recovery-key-signed atomic revocation** (revocation leaf appended + claim row deleted in one transaction; per [ADR 0004 addendum-1](decisions/0004-tl-leaf-schema-evolution.md))
- **Canonical bytes once** ([ADR 0005](decisions/0005-canonical-on-both-sides.md)) — JSON canonicalization on the raw object, never on a storage round-trip; cross-language byte-match validation
- **Four-discriminated-outcome verification surface** (`verified` / `unverified` / `handle-mismatch` / `stale-proof`) with structured `reason_code` on the `unverified` branch
- **Read/write deployment split** ([ADR 0007](decisions/0007-http-cache-and-read-write-split.md)) — write side (Fly.io) and read side (Cloudflare Worker) separate by design
- **Apache 2.0 + trademark separation** ([TRADEMARK.md](../TRADEMARK.md)) — code is permissive; brand is protected; canonical impl pointer at `cloakmaster/foxbook`
- **Typed-reference v1.0 schema for composition** ([ADR 0009](decisions/0009-typed-reference-schema-for-composition.md)) — agent-identity-anchor citation shape for evidence-layer envelopes (Concordia v0.5+, others)

## Public timeline

Authoritative invention record, chronological. All artifacts are public + timestamped at the cited surfaces.

| Date | Event | Verifiable artifact |
|---|---|---|
| 2026-04-23 | First commit on `cloakmaster/foxbook` | `git log --reverse --format='%h %ad %s' --date=iso` |
| 2026-04-23 | [ADR 0004](decisions/0004-tl-leaf-schema-evolution.md) — `tl-leaf` schema evolution + revocation atomicity (additive-only within v1.x; revocation leaf + delete-on-revoke) | git log on `docs/decisions/0004-tl-leaf-schema-evolution.md` |
| 2026-04-24 | [ADR 0005](decisions/0005-canonical-on-both-sides.md) — canonical-bytes algorithm (RFC 8785-shaped; insertion-order JCS; cross-language byte-match validation) | git log on `docs/decisions/0005-canonical-on-both-sides.md` |
| 2026-04-26 | [ADR 0006](decisions/0006-protocol-not-marketplace.md) — protocol-not-marketplace path-ordering rule + co-option failure mode | git log on `docs/decisions/0006-protocol-not-marketplace.md` |
| 2026-04-28 | `transparency.foxbook.dev` Cloudflare Worker custom domain bound | `apps/transparency/wrangler.toml` line 44 comment |
| 2026-04-30 | CTEF v0.3.1 byte-match (4/4 vectors) at commit `9e392c5` — independent canonicalizer (`canonicalize@2.1.0`) reproduction | [`ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md`](../ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md) |
| 2026-05-01 | `api.foxbook.dev` Fly.io deploy live | first `gh release create v0.1.0` |
| 2026-05-01 | `@foxbook/sdk-claim@0.1.0` published on npm — six-function reference SDK | `npm view @foxbook/sdk-claim time` |
| 2026-05-03 | `tl-leaf` v1.2 — `signing-key-registration` rotation shape ratified ([ADR 0004 addendum-3](decisions/0004-tl-leaf-schema-evolution.md)) | PR #60 commit `982804c` |
| 2026-05-03 | `@foxbook/sdk-claim@0.2.0` published — `verified_signing_key_hex` + structured `reason_code` discriminator | npm registry; PR #61 commit `495c694` |
| 2026-05-03 | gh release `v0.2.0` tagged | https://github.com/cloakmaster/foxbook/releases/tag/v0.2.0 |
| 2026-05-04 | A2A Discussion #1803 closed; substrate-mode close announcement | https://github.com/a2aproject/A2A/discussions/1803#discussioncomment-16809407 |
| 2026-05-04 | Discussion #73 opened with v1.0 typed-reference schema strawman | https://github.com/cloakmaster/foxbook/discussions/73 |
| 2026-05-04 | [ADR 0008](decisions/0008-stable-mode-maintenance-posture.md) ratified — stable-mode maintenance posture | git log on `docs/decisions/0008-stable-mode-maintenance-posture.md` |
| 2026-05-04 | Worked-example gist with running RFC 9162 verifier published | https://gist.github.com/cloakmaster/0e07c1aed0c7cae61484a01762e6ed9b |
| 2026-05-04 | `@foxbook/sdk-claim@0.2.1` published — stable shape | npm registry |
| 2026-05-04 | gh release `v0.2.1` tagged | https://github.com/cloakmaster/foxbook/releases/tag/v0.2.1 |
| 2026-05-08 | [ADR 0009](decisions/0009-typed-reference-schema-for-composition.md) ratified at v1.0 — typed-reference schema for composition (Concordia + Sanctuary) | PR #77 commit `92ec902` |
| 2026-05-08 | `schemas/typed-reference.v1.json` JSON Schema artifact published | git log on `schemas/typed-reference.v1.json` |

## Cross-implementation reference cycle

Per [ADR 0006 §4](decisions/0006-protocol-not-marketplace.md), named cross-impl references are the load-bearing co-option-defense indicator. As of the writing of this document:

| Reference | Status | Date | Surface |
|---|---|---|---|
| Harness aggregator (`evidence_provider`, `claim_type_layer: identity`) | Live | 2026-04-30 | https://agentgraph.co/.well-known/interop-harness.json |
| CTEF v0.3.1 byte-match (4/4 vectors) | Verified | 2026-04-30 | [`ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md`](../ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md) (commit `9e392c5`) |
| AgentGraph litepaper §1.8 (substrate-and-primitive layering) | Publishing 2026-05-12 | TBD | TBD post-publish |
| CTEF v0.3.2 §A Conformance Appendix (Foxbook as 1 of 6 reproducibility receipts) | Publishing ~2026-05-20 | TBD | TBD post-publish (citation pin in [`docs/RATIONALE.md`](RATIONALE.md)) |
| Concordia + Sanctuary typed-reference v1.0 (cross-impl ratified) | Spec'd | 2026-05-08 | [Discussion #73](https://github.com/cloakmaster/foxbook/discussions/73) |

## What this page does NOT establish

- **Patent claims.** Foxbook has no patents and does not intend to file any. Per [ADR 0006](decisions/0006-protocol-not-marketplace.md), the protocol-not-marketplace stance forbids patent strategies. This page is defensive prior art, not offensive IP.
- **Trademark scope beyond TRADEMARK.md.** The "Foxbook" name is protected per [TRADEMARK.md](../TRADEMARK.md); USPTO formal registration is flagged as future spend.
- **Exclusivity.** Forks under different names are explicitly OK per Apache 2.0 + TRADEMARK.md §"What's explicitly OK without permission."

## How to cite this prior art

If you need to cite Foxbook's invention timeline (academic work, patent prior-art search, RFC reference, etc.), the canonical citation is:

> Bandali, B. *Foxbook — verifiable agent identity primitive for A2A and MCP.* Apache License 2.0. Open-source reference implementation at https://github.com/cloakmaster/foxbook (first commit 2026-04-23). Architectural decision records ADR 0001-0009. Public deployments at https://transparency.foxbook.dev / https://api.foxbook.dev. SDK at https://www.npmjs.com/package/@foxbook/sdk-claim. Cross-implementation reference cycle indexed at [`docs/INTEGRATIONS.md`](INTEGRATIONS.md).
