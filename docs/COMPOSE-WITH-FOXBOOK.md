# Composing with Foxbook

Short guide for systems that want to compose against Foxbook's transparency-log primitive. Audience: implementors of evidence-layer, verdict-layer, or other identity-anchored systems who've decided "we want to cite Foxbook-verified identity inside our protocol."

For the catalog of known compositions, see [`INTEGRATIONS.md`](INTEGRATIONS.md).

## What Foxbook offers

- **Verified identity primitive**: `verifyAgentCard(card)` returns one of four discriminated outcomes — `verified`, `unverified`, `handle-mismatch`, `stale-proof` — backed by an RFC 9162-shaped Merkle transparency log. Four outcomes; no numeric trust score; no reputation field.
- **Public transparency log**: `https://transparency.foxbook.dev/` — read endpoints (`/root`, `/inclusion/:i`, `/leaf/:i`) under Apache 2.0, no auth, no API key. Anyone can verify any claim independently.
- **SDK**: `@foxbook/sdk-claim` on npm. Six-function reference impl for the claim flow + verification primitives.
- **Stable shape**: SDK v0.2.0 surfaces `verified_signing_key_hex` + `leaf_index` on the `verified` branch of `verifyAgentCard`. tl-leaf v1.2 (`agent-key-registration`, `revocation`, `signing-key-registration`) is the canonical-bytes shape your typed reference would cite.

## Typical composition shape: typed reference

The most common pattern: your envelope / receipt / attestation carries a **typed reference** to a Foxbook leaf, and your verdict-layer anchors on that reference.

The active spec discussion for the typed-reference schema is here:

**https://github.com/cloakmaster/foxbook/discussions/73**

(Once the schema is agreed, [`docs/decisions/0009-typed-reference-schema-for-composition.md`](decisions/0009-typed-reference-schema-for-composition.md) ratifies it on the Foxbook side.)

The strawman shape includes:

- `tl_url` — base URL of the transparency log
- `leaf_index` — position of the leaf in the log
- `tl_leaf_canonical_hash` — SHA-256 of the canonical-bytes leaf preimage (per [ADR 0005](decisions/0005-canonical-on-both-sides.md))
- `verified_signing_key_hex` — the agent's active Ed25519 signing key at verify-time

Plus optional fields for stronger offline / temporal-anchor verification (`sth_at_verify_time`, `sth_signature`). See the discussion thread for the full schema + negative-path scenarios.

## Other composition shapes

- **Wrapping**: your system's identity primitive includes Foxbook verification as one of N supported identity sources. Foxbook returns its discriminated result; your wrapper maps it to your unified shape. No new typed reference needed.
- **Referencing without embedding**: your receipt mentions Foxbook by URL but doesn't carry a structured typed reference. Lower integrity guarantees (your verifier can't detect log forks); simpler shape.
- **Direct API integration**: your service calls Foxbook's `/api/v1/claim/by-handle/...` endpoint at decision-time. No typed reference needed because verification is fresh-by-construction.

If your shape doesn't fit any of the above, open a Discussion in `cloakmaster/foxbook` and propose it.

## How to engage

1. **Read the existing context** — [README.md](../README.md), [RATIONALE.md](RATIONALE.md), [ADRs 0001–0008](decisions/), the active Discussion thread above.
2. **Open a thread** — for typed-reference compositions, the existing thread at https://github.com/cloakmaster/foxbook/discussions/73. For novel compositions, a new Discussion in `cloakmaster/foxbook`.
3. **Substantive offline** — `hello@foxbook.dev` for spec sessions, walk-throughs, or anything that benefits from a back-and-forth that's not public.
4. **Once agreed publicly** — open a PR adding your composition to [INTEGRATIONS.md](INTEGRATIONS.md). The catalog grows organically.

## What you don't get

- **Active feature work** — Foxbook is in stable / maintenance mode per [ADR 0008](decisions/0008-stable-mode-maintenance-posture.md). Spec extension requests for Foxbook itself are noted but not actioned.
- **Per-call SLAs** — operational SLA is best-effort. The runbook at [OPERATIONS.md](OPERATIONS.md) documents the tier choices and uptime monitoring.
- **Closed-source verification** — everything is Apache 2.0 + open canonical bytes. If you want closed-source for compliance reasons, fork under a different name; the spec contract is what matters for interop.

## Cross-references

- [README.md](../README.md) — the 60-second pitch
- [RATIONALE.md](RATIONALE.md) — why Foxbook is shaped the way it is
- [VERIFY-IN-60-SECONDS.md](VERIFY-IN-60-SECONDS.md) — verify a live agent card from a fresh shell
- [INTEGRATIONS.md](INTEGRATIONS.md) — catalog of active compositions
- [decisions/](decisions/) — full ADRs
- Harness aggregator entry: [`agentgraph.co/.well-known/interop-harness.json`](https://agentgraph.co/.well-known/interop-harness.json)
