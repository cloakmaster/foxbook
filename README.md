# 🦊 Foxbook

[![CI](https://github.com/cloakmaster/foxbook/actions/workflows/ci.yml/badge.svg)](https://github.com/cloakmaster/foxbook/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Verifiable agent identity for A2A and MCP.

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

// Before your agent calls another agent, check its card.
const result = await verifyAgentCard(otherAgent.card);
if (result.status !== "verified") return;
// Verified. Safe to call.
```

Open source. Apache 2.0. Run your own log; anyone following the same spec can verify against any deployment.

[**Live demo**](#live-demo) · [**Why**](#why) · [**Status**](#status) · [**RFC**](docs/rfc-a2a-x-foxbook-extension.md)

---

## When this fires

You're building an agent. It needs to hand work off to another agent it didn't write. The other agent's *card* — the JSON manifest agents publish at /.well-known/agent-card.json per A2A — says `handle: @somebody-trustworthy`. That's just a string. Anyone can write anything there. If you call the other agent before checking, the work goes to whoever wrote the handle, not whoever owns it.

`verifyAgentCard(card)` is the check before the call.

---

## Live demo

The log is real. One curl proves it.

```bash
curl -s https://transparency.foxbook.dev/root | jq
```

Returns a signed tree head. Combine /inclusion/:i with /root and verify the Merkle proof. RFC 9162 shape; no auth, no API key.

An adversarial test of the identity guard, refused before any network I/O. `fetchCount === 0` at the adapter. [Read the transcript.](ops/evidence/2026-04-24-identity-guard-adversarial.md)

---

## Why

When one agent calls another, it has no cryptographic way to prove the handle on the other agent's card is real. Today the answer is "trust the directory" or "build your own check." Foxbook is a third answer: a public log anyone can verify against, in one function call, four possible outcomes.

`verifyAgentCard(card)` returns one of four outcomes:

- `verified` → proceed
- `unverified` → block
- `handle-mismatch` → block (the card claims a handle the log doesn't attest)
- `stale-proof` → caller's risk policy (refresh, retry, warn)

That's the whole verification surface. No trust score. No reputation field. Identity goes here; reputation goes in a layer above.

---

## Why this exists

Agents are about to call other agents 10x more often than they do today. Each call needs to verify the handle on the receiving card. Without a verification primitive, every call is trust-by-faith — the card says it's `@somebody`, the calling agent has no way to know.

The primitive has to be three things: cryptographic, public, and free. Cryptographic so claims can't be forged. Public so anyone can audit without asking permission. Free so adoption isn't gated on commercial relationships.

RFC 9162 (Certificate Transparency) has been the model for this in the TLS world for ten years — every certificate your browser trusts gets logged into a public, append-only Merkle tree, and Chrome refuses certificates that aren't logged. Foxbook is that pattern, applied to agent identity.

A2A and MCP both opened discussions about trust between agents — composable evidence, reputation, identity-extension fields. None of them shipped the piece underneath. Foxbook ships it.

---

## Status

**Stable / maintenance mode** ([ADR 0008](docs/decisions/0008-stable-mode-maintenance-posture.md)). Public commitments shipped; protocol surface frozen at v0.2; live deployments + brand + ops continuity preserved. PRs welcome for bug fixes and docs; review may take weeks. Security: `hello@foxbook.dev`.

**Live**

- Public transparency log: signed tree head per append, consistency proofs.
- Tier-1 verification via GitHub Gist, with an identity guard at the URL-owner level.
- Tier-2 verification via DNS TXT and signed-nonce endpoint challenge.
- Recovery-key signed revocation: atomic across leaf append and claim delete. Observed at 467ms wall-clock against live Postgres (single-run benchmark).
- Firehose stream: 20ms median commit-to-receive latency (single-run benchmark).
- `@foxbook/sdk-claim@0.2.0` on npm — six-function reference SDK with `verified_signing_key_hex` on the verified branch + structured `reason_code` on the unverified branch.
- Registered as `evidence_provider` on the identity-layer slot at [`agentgraph.co/.well-known/interop-harness.json`](https://agentgraph.co/.well-known/interop-harness.json) with CTEF v0.3.1 byte-match validation (4/4 vectors).

**Not in scope under stable mode**

- New protocol features, new SDK functions, new endpoints, new schema shapes. Per [ADR 0008](docs/decisions/0008-stable-mode-maintenance-posture.md). Forks under different names that extend the protocol are welcome (see [TRADEMARK.md](TRADEMARK.md)).
- Multi-vendor federated logs (the protocol contract is identical; bring your own deployment under your own name).

---

## Quickstart

Verify one record (a "leaf" in the Merkle tree), no install:

```bash
curl -s https://transparency.foxbook.dev/inclusion/1
curl -s https://transparency.foxbook.dev/root
```

The proof can be verified in any language. Test vectors at [`schemas/crypto-test-vectors.json`](schemas/crypto-test-vectors.json) keep implementations in sync.

Workspace, locally:

```bash
git clone https://github.com/cloakmaster/foxbook.git
cd foxbook
pnpm install
pnpm -r test
```

---

## License

Apache 2.0. See [`LICENSE`](LICENSE).

The protocol is open. The **Foxbook** name has a trademark; see [`TRADEMARK.md`](TRADEMARK.md). Run your own log under your own name; the spec is the standard, not the host.

---

Built by [@cloakmaster](https://github.com/cloakmaster).
