# RFC: `x-foxbook` v1 — verifiable agent provenance for A2A AgentCards

**Status:** draft (Foxbook-internal review — Day 7).
**Target:** upstream into the [A2A AgentCard specification](https://github.com/google/A2A) as an extension namespace.
**Author:** Benjamin (Foxbook). Submission to the A2A repository scheduled for end of week 2.

---

## 1. Motivation

Agent-to-agent infrastructure is shipping faster than the verification layer that anchors it. Today, an agent receiving an `AgentCard` from another agent has no cryptographic basis for distinguishing:

1. The card published by the human owner of that handle.
2. A re-published card swapped by anyone who scraped the original.
3. A handle-spoofing attempt where the card claims an identity the publisher does not own.

The A2A spec gives agents a portable shape for *what they advertise*; it does not give them a portable shape for *how to prove who advertised it*. **`x-foxbook` v1 is that proof layer**, designed to slot under the existing `AgentCard` extension surface without breaking deployments that don't use it.

### 1.1 The agent hiring gate (motivating runtime-safety pattern)

Every agent-to-agent call is an authorization decision. Today most callers skip the question — they read the AgentCard, dispatch the request, and trust the wire. The pattern we're proposing makes the question explicit:

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const v = await verifyAgentCard(card, { requireFreshSTH: 3600 });
switch (v.status) {
  case "verified":         break;             // proceed
  case "unverified":       return refuse(v);  // hard block
  case "handle-mismatch":  return refuse(v);  // hard block — different handle
  case "stale-proof":      return warn(v);    // caller's risk policy
}
// ...dispatch the call
```

The four discriminated outcomes map to {allowed, blocked, blocked, warning}. **No numeric trust score** — the boundary between verification (cryptographic) and reputation (subjective) is preserved.

### 1.2 The failure mode this RFC pre-empts

Forking a transparency log is structurally low-credibility — trust history is per-leaf and non-transferable, so a fork dies on first contact with "why should I trust this fork's leaves?" The real failure mode is **co-option by adjacent incumbents**: MCP ships native identity, A2A absorbs verification semantics directly, and a parallel proof layer becomes redundant. The defence is shipping the reference implementation FIRST and getting it referenced by the spec authors. **This RFC is that ask.**

---

## 2. Motivating example — the cloakmaster vs samrg472 identity-guard demo

On 2026-04-24, we attempted to hijack a GitHub handle through the Foxbook claim flow. The transcript is at [`ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md`](../ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md). The condensed version:

1. Foxbook minted a verification code for `claim_id=A` against `asset_value=samrg472`.
2. The `cloakmaster` agent (a different real GitHub handle) published a Gist containing the code.
3. The agent posted that Gist URL — `gist.github.com/cloakmaster/...` — to `POST /api/v1/claim/verify-gist`, asking Foxbook to attest "samrg472 is verified by this signing key."

The reference verifier refused with `409 identity-mismatch`. **Crucially: `fetchCount === 0` at the adapter** — Foxbook never even fetched the Gist contents. The identity check ran against the URL's path username (`cloakmaster`) before any network I/O, and the mismatch with the claim's `asset_value` (`samrg472`) terminated the flow.

That guard is not a special case. It's the structural property `x-foxbook` v1 inherits: **the evidence URL's owner identity is bound to the claim's asset value before any content is read**. A scout that respects this binding cannot be tricked into attesting handle ownership the publisher does not own.

This is what we want the A2A spec to point at when readers ask "how do I trust an AgentCard's handle field?"

---

## 3. Proposed extension — `x-foxbook` v1

The full schema lives at [`schemas/x-foxbook.v1.json`](../schemas/x-foxbook.v1.json) (JSON Schema, draft 2020-12). Below is the minimal shape every conforming consumer must understand:

```jsonc
{
  // ... standard A2A AgentCard fields ...
  "x-foxbook": {
    "did": "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
    "foxbook_url": "https://foxbook.dev/agents/did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
    "verification_tier": 1,
    "verified_asset": {
      "type": "github_handle",
      "value": "samrg472",
      "verified_at": "2026-04-26T10:00:00Z",
      "method": "github_gist"
    },
    "class_or_instance": "instance",
    "version_hash": "sha256:...",
    "signatures": {
      "ed25519_public_key_hex": "...",
      "recovery_key_fingerprint": "sha256:...",
      "jws_signature": "<compact JWS over canonical card bytes>",
      "transparency_log_entry": "https://foxbook.dev/log/leaf/1"
    },
    "updated_at": "2026-04-27T08:00:00Z"
  }
}
```

The fields and their constraints:

| Field | Type | Required | Notes |
|---|---|---|---|
| `did` | `did:foxbook:{ULID}` | yes | Stable identifier; never reissued. |
| `foxbook_url` | URI | yes | Profile URL on the canonical reference deployment. |
| `verification_tier` | 0 \| 1 \| 2 \| 3 \| 4 | yes | 0 = pre-claim shadow; 1 = Gist/tweet/email; 2 = DNS+endpoint; 3 = GitHub Org/DMARC; 4 = Sigstore (optional). |
| `verified_asset` | object | conditional | Required when tier ≥ 1. Binds the claim to a real-world handle. |
| `class_or_instance` | enum | yes | Disambiguates agent classes (templates) from running instances. |
| `version_hash` | `sha256:{hex}` | yes | Content hash of the canonical AgentCard bytes. |
| `signatures.ed25519_public_key_hex` | 64-char hex | yes | The agent's signing key. |
| `signatures.jws_signature` | compact JWS | yes | Signature over canonical-bytes of the AgentCard sans `signatures.jws_signature` itself. |
| `signatures.transparency_log_entry` | URI | conditional | Required when tier ≥ 1 — the inclusion-proof URL for this agent's leaf. |
| `revoked` | boolean | optional | Set true after a recovery-key-signed revocation lands. |
| `updated_at` | ISO-8601 | yes | Last mutation; helps consumers cache. |

### 3.1 Canonical bytes rule (non-negotiable)

`jws_signature` covers the canonical UTF-8 byte serialization of the AgentCard with `signatures.jws_signature` removed. **Canonicalization is alphabetical key order, no whitespace, no lossy escape transformations.** The reference implementation's primitive is at `core/src/crypto/canonical.ts`; cross-language test vectors (TS + Python round-trip) live at `schemas/crypto-test-vectors.json` under the `jws_round_trip` fixture. Re-implementations MUST round-trip those vectors byte-for-byte.

### 3.2 Why DID, not URL-keyed identity

The `foxbook_url` is mutable (rebrand, redirect, host change). The `did:foxbook:{ULID}` is not. Every signature, every leaf, every reference ties back to the DID — the URL is purely a discovery convenience. This is the same reasoning that anchors W3C's `did:` namespace; we keep the pattern consistent.

---

## 4. Reference implementation

The canonical reference deployment is `foxbook.dev`. Anyone can run a parallel deployment that satisfies the same contracts; this is protocol infrastructure, not a marketplace (see [ADR 0006 — protocol-not-marketplace](decisions/0006-protocol-not-marketplace.md)).

### 4.1 Live transparency log

URL: `https://foxbook-transparency.inkog-io.workers.dev` (placeholder until canonical `transparency.foxbook.dev` DNS lands; week 2 task).

Endpoints:

- `GET /root` — current signed tree head.
- `GET /leaf/:index` — leaf bytes + leaf hash + appended-at timestamp.
- `GET /inclusion/:index` — inclusion proof.
- `GET /consistency/:from/:to` — consistency proof (gossip-friendly).

The shape is RFC 9162-compatible.

### 4.2 Cross-language verification primitives

`schemas/crypto-test-vectors.json` ships byte-for-byte fixtures that any conforming implementation must round-trip:

- `canonical_json` — input → expected canonical UTF-8 bytes.
- `jws_round_trip` — input → expected compact-JWS string for a known seed.
- `merkle_inclusion` — input leaves → expected root + proof.

The TS reference implementation ([`core/src/`](../core/src)) and Python equivalent (week 2) both pass the same fixtures. Re-implementers in Go / Rust / etc. should produce byte-identical output.

### 4.3 Live revocation evidence

On 2026-04-26 the revocation-flow harness shipped end-to-end against live Neon Postgres. The artifact is at [`ops/bench-results/2026-04-26-first-live-revocation.txt`](../ops/bench-results/2026-04-26-first-live-revocation.txt):

- Six smoke-test assertions covering claim/start → tier-1 → revoke → re-claim with a fresh key.
- Wall-clock 467ms (budget 500ms) for the full revoke POST.
- Atomic across `merkle.append` + firehose insert + claim delete.

This is not a "demo flow." The same code runs on the reference deployment.

### 4.4 Reference SDK (`@foxbook/sdk-claim`)

Six-function public surface (`packages/sdk-claim/`):

- `claimStart`, `claimVerifyGist`, `claimRevoke` — claim primitives.
- `verify` — transparency-log inclusion-proof primitive.
- `foxbookVerify(handle)` — handle-level convenience wrapper.
- `verifyAgentCard(card, options)` — the agent-hiring-gate runtime-safety primitive (§1.1).

Day-7 ships the contract (signatures + discriminated unions); week-2 ships the implementation. Tight surface (~130 LOC) so re-implementations in other languages have a clear target.

---

## 5. Open questions for the A2A spec authors

We're proposing this as an extension namespace, not a core-spec change. Concrete questions where the spec authors' direction is load-bearing:

1. **Where MCP and A2A meet on identity.** If MCP ships a native identity surface, do A2A AgentCards consume the MCP identity primitive directly, or do both protocols reference a third (this `x-foxbook`-style proof layer)? We have a strong opinion (the latter — verification is its own concern), but the spec authors' position determines whether `x-foxbook` slots in or gets superseded.

2. **Revocation interop.** Is there a desired shape for "the revocation list for verified agents" that A2A consumers should poll? `x-foxbook` v1 surfaces revocation via `revoked: true` on the card itself + the transparency log's revocation leaf type, but there's no spec-level "revocation feed" today. Should there be?

3. **Deprecation path.** Once v2 lands (year-1 candidate features: tier-upgrade attestability, multi-log gossip), what's the deprecation lifecycle for v1 cards in the wild? Foxbook's commitment is ≥90 days from breaking-change announcement; we'd align with whatever the A2A spec settles on.

---

## 6. What this RFC explicitly does not propose

Per [ADR 0006 — protocol-not-marketplace](decisions/0006-protocol-not-marketplace.md):

- **No marketplace UI** spec changes. `x-foxbook` is a proof layer, not a discovery surface.
- **No paid placement** of any kind in the verification flow.
- **No closed-source moat.** The reference implementation is open; canonicality comes from being the first credible reference, not from controlling the code.
- **No forced onboarding.** Agents that don't ship `x-foxbook` continue to work in A2A unchanged; this RFC adds an *option* for verifiable provenance, not a requirement.
- **No agent-side payment rails** in v1 of `x-foxbook`. Payment surfaces stay in their own schemas.

Future planners MUST NOT re-propose any of the above without an ADR amendment that addresses ADR 0006 §4 path-ordering.

---

## 7. References

- ADR 0006 — protocol-not-marketplace (`docs/decisions/0006-protocol-not-marketplace.md`)
- ADR 0001 — service-agnostic core (`docs/decisions/0001-service-agnostic-core.md`)
- ADR 0005 — canonical bytes are written once (`docs/decisions/0005-canonical-bytes.md`)
- LOCKED.md — pinned non-negotiables (`docs/foundation/LOCKED.md`)
- Live evidence — identity-guard refusal (`ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md`)
- Live evidence — first-live-revocation 467ms (`ops/bench-results/2026-04-26-first-live-revocation.txt`)
- Schema — `schemas/x-foxbook.v1.json`
- Schema — `schemas/tl-leaf.v1.json`
- Crypto test vectors — `schemas/crypto-test-vectors.json`
