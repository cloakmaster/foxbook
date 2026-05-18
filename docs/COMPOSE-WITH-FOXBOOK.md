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

## Suggested verifier-behavior patterns (non-normative)

Non-normative reference for relying-party gateways composing against Foxbook's verification primitive, sourced from @MusaabHasan's verifier-behavior matrix on [A2A Discussion #1803](https://github.com/a2aproject/A2A/discussions/1803) (2026-05-09).

`verifyAgentCard` returns one of four discriminated outcomes:

```
verified          → identity binding holds + leaf is in the log + STH is fresh
unverified        → handle not claimed, OR inclusion proof failed, OR card malformed (with structured reason_code)
handle-mismatch   → claim row's asset_value differs from the card's claimed handle
stale-proof       → STH timestamp older than caller's requireFreshSTH threshold
```

These describe **identity state at verify-time**, not authorization. The verdict-layer (gateway, policy engine, etc.) layers policy on top. Suggested mapping from Foxbook outcome to gateway policy below, with the structural notes that explain *why* each row makes sense.

| Foxbook outcome | Suggested gateway behavior | Structural note |
|---|---|---|
| `handle-mismatch` | Fail closed — block before any network I/O. | Detected against the by-handle endpoint's claim row, which is the source of truth for handle-to-DID binding. No ambiguity to retry through. |
| `unverified` with `reason_code: handle-not-claimed` (revoked claim) | Fail closed for **new** actions. For **historical audit** (validating signatures made before revocation), policy reduces to a timestamp comparison: `sth_at_verify_time.timestamp` vs revocation timestamp. If the proof's STH predates revocation, the historical action verifies. | Per [ADR 0004 addendum-1](decisions/0004-tl-leaf-schema-evolution.md), revocation is atomic at the protocol layer — the revocation leaf is appended and the claim row is deleted in a single transaction. The leaf stays in the log forever as audit history. Two sources of truth never disagree about revocation state by construction. |
| `unverified` with `reason_code: inclusion-proof-failed` | Fail closed. | A failed inclusion proof is a structural integrity issue, not a transient operational state. The proof reconstructs the Merkle root from leaf hash + path; failure means either the leaf isn't where the claim says it is, or the log returned inconsistent data. Neither retries cleanly. |
| `unverified` with `reason_code: key-not-yet-logged` | Retry or fail soft — depends on freshness policy. The rotation transition window is bounded (next STH issuance). | Per [ADR 0004 addendum-3](decisions/0004-tl-leaf-schema-evolution.md), surfaces during the brief window when a new signing key has been registered as a `signing-key-registration` leaf but isn't yet covered by the latest STH. Retrying after the freshness window resolves the rotation transition. |
| `unverified` with `reason_code: card-malformed` | Fail closed. | The card's structure is wrong; no verification path can succeed. |
| `stale-proof` | Require refresh before high-risk action; allow with reduced trust for low-stakes operations per policy. | The `requireFreshSTH` option encodes the freshness threshold; breach surfaces this outcome. The relying party owns the threshold per its threat model. |
| `verified` + downstream evidence available | Identity accepted at the cryptographic layer; authorization is a separate verdict. | Layer separation per [ADR 0006](decisions/0006-protocol-not-marketplace.md): identity is necessary but not sufficient for authorization. A verified identity may still be denied based on policy (capability scope, reputation, mandate, etc.). |

### Operational cases worth keeping in a conformance suite

Per @MusaabHasan's first comment on [A2A #1803](https://github.com/a2aproject/A2A/discussions/1803) (2026-05-08):

1. **Key rotation** — new key registered, old signatures still verify against historical leaf.
2. **Recovery-key compromise** — DoS available; impersonation not (separate signing/recovery key pair per ADR 0004).
3. **Log unavailability** — SDK returns `{status: "error", reason: ...}`; verdict-layer policy decides fail-open vs fail-closed per its own threat model.
4. **Stale inclusion proof** — `stale-proof` outcome via `requireFreshSTH`.
5. **Handle re-claim after revocation** — new claim produces a new ULID; old leaf stays in the log forever.
6. **Malicious card pointing to old-but-once-valid identity proof** — `requireFreshSTH` is the primary mitigation; verdict-layer policy can additionally reject typed references with `sth_at_verify_time.timestamp` older than its own policy threshold.

### Note on `verification-service-unavailable`

`verification-service-unavailable` is not a discriminated outcome in Foxbook v0.2. The SDK surfaces this as `{status: "error", reason: <network/HTTP detail>}`. Promoting it to a discriminated outcome would be a v1.x schema bump; deferred under stable-mode posture ([ADR 0008](decisions/0008-stable-mode-maintenance-posture.md)). If it becomes a real adoption blocker for any integrator, re-open the discussion in [Discussion #73](https://github.com/cloakmaster/foxbook/discussions/73).

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
