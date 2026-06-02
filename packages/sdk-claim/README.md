# @foxbook/sdk-claim

Verifiable agent identity for A2A and MCP. The reference TypeScript SDK for the Foxbook claim flow + verification: claim a handle, verify the claim landed in the public transparency log, and check another agent's card before dispatching work.

## Install

```bash
pnpm add @foxbook/sdk-claim
# or: npm install @foxbook/sdk-claim
# or: yarn add @foxbook/sdk-claim
```

## Use

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const result = await verifyAgentCard(otherAgent.card, {
  asset_type: "github_handle",
  requireFreshSTH: 3600, // optional: reject STHs older than 1h
});

if (result.status !== "verified") {
  // block, log, fall through to your risk policy
  return;
}
// Verified. Safe to call.
```

`verifyAgentCard` returns one of four discriminated outcomes:

| Outcome | Meaning | Mapping |
|---|---|---|
| `verified` | Card's handle is in the transparency log AND inclusion proof reconstructs cleanly | allowed |
| `unverified` | Handle not in the log OR proof failed | blocked (or retry, see `reason_code`) |
| `handle-mismatch` | Card claims a different DID than the log attests for the handle | blocked |
| `stale-proof` | STH older than `requireFreshSTH` threshold | warning (caller decides) |

The `verified` branch carries `verified_signing_key_hex` — the agent's currently active Ed25519 signing key — so an enforcement gateway can verify the AgentCard's JWS signature in one call rather than two.

The `unverified` branch carries an optional structured `reason_code` (`handle-not-claimed` / `inclusion-proof-failed` / `key-not-yet-logged` / `card-malformed`) so callers can branch on retry-vs-block without parsing the free-form `reason` string. `key-not-yet-logged` is reserved for the rotation transition window — when an AgentCard's signing-key-registration leaf has been written but isn't yet in the latest STH; callers should retry shortly rather than permanent-block.

No numeric trust score, no reputation field — verification is kept separate from reputation by design.

## API surface

| Function | What it does |
|---|---|
| `claimStart(input)` | `POST /api/v1/claim/start` — mint did + verification code |
| `claimVerifyGist(input)` | `POST /api/v1/claim/verify-gist` — transition to tier 1 via GitHub Gist |
| `claimRevoke(input)` | `POST /api/v1/claim/revoke` — recovery-key signed revocation |
| `verify(input)` | RFC 9162 inclusion-proof primitive — verifies the log's signed tree head (STH) JWS against the Ed25519 key from `/.well-known/foxbook.json`, then pins the proof to the *signed* root (fail-closed) |
| `foxbookVerify(input)` | Handle → `{tier, revoked, did, leafIndex}` (or `not-claimed`) |
| `verifyAgentCard(card, options)` | Runtime-safety gate; chains `foxbookVerify` + handle-mismatch + `verify` + freshness |

All functions accept per-call `apiBase` / `worker_base` overrides; the defaults point at the canonical reference deployment:
- `DEFAULT_API_BASE = "https://api.foxbook.dev"`
- `DEFAULT_WORKER_BASE = "https://transparency.foxbook.dev"`

## What this is

Foxbook is a verifiable identity primitive for agents. A receiving agent reading an A2A AgentCard has no cryptographic basis for trusting the `handle` field on its own. Foxbook fixes that with an Ed25519 + RFC-9162-shaped public Merkle transparency log: claim your handle, the claim lands as a leaf in the log, and any other agent can verify the binding before dispatching work to you.

This SDK is the TypeScript surface anyone calls to:

1. **Claim** a handle (`claimStart` → publish verification code → `claimVerifyGist`).
2. **Revoke** a claim (`claimRevoke` with a recovery-key-signed JWS).
3. **Verify** another agent's card before calling them (`verifyAgentCard`).

## Live verification you can run right now

The transparency log is live and unauthenticated. Walk the proof yourself:

```bash
curl -s https://transparency.foxbook.dev/root | jq
curl -s https://transparency.foxbook.dev/inclusion/0 | jq
```

The signed tree head returned by `/root` matches what `verifyAgentCard` reconstructs internally.

## Compose with Foxbook

If you're building an evidence-layer, verdict-layer, or other identity-anchored system that wants to cite Foxbook-verified identity, see:

- [`docs/COMPOSE-WITH-FOXBOOK.md`](https://github.com/cloakmaster/foxbook/blob/main/docs/COMPOSE-WITH-FOXBOOK.md) — engagement path, typed-reference shape
- [`docs/INTEGRATIONS.md`](https://github.com/cloakmaster/foxbook/blob/main/docs/INTEGRATIONS.md) — catalog of active compositions

Foxbook is in [stable / maintenance mode](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/0008-stable-mode-maintenance-posture.md); composition is welcome.

## Design rationale

The SDK was first proposed as the upstream reference for the A2A spec's identity layer. See the design context, four-discriminated-outcomes rationale, and CTEF v0.3.1 byte-match interop validation:

- A2A Discussion #1803: <https://github.com/a2aproject/A2A/discussions/1803>
- Repo: <https://github.com/cloakmaster/foxbook>
- Live transparency log: <https://transparency.foxbook.dev>
- CTEF v0.3.1 byte-match report: <https://github.com/cloakmaster/foxbook/blob/main/ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md>

## License

Apache 2.0. The protocol contract is open; anyone can run a parallel deployment, the spec is the standard, not the host.
