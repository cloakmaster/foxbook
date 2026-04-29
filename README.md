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

[**Live demo**](#live-demo) · [**Why**](#why) · [**Status**](#status) · [**RFC**](docs/rfc-a2a-x-foxbook-extension.md) · [**Roadmap**](PROJECT-PLAN.md)

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

I'm a solo founder. Over the last six weeks, A2A and MCP both opened discussions about trust between agents — composable evidence, reputation, identity fields on agent cards. None of them landed the piece underneath: a way to prove an agent actually owns the handle it claims.

So I built it. The log above is live. The adversarial test of the identity guard refused a fake claim before any network call. If it's useful, run your own log. If something breaks, file an issue.

---

## Status

**Live**

- Public transparency log: signed tree head per append, consistency proofs.
- Tier-1 verification via GitHub Gist, with an identity guard at the URL-owner level.
- Tier-2 verification via DNS TXT and signed-nonce endpoint challenge.
- Recovery-key signed revocation: atomic across leaf append and claim delete. Observed at 467ms wall-clock against live Postgres (single-run benchmark).
- Firehose stream: 20ms median commit-to-receive latency (single-run benchmark).
- 173 in-process tests, 4 gated integration tests.

**Not yet live**

- SDK npm publish (signatures committed; implementation in progress).
- MCP server (in progress).
- Production WAN load test (planned).
- Multi-vendor federated logs (the protocol contract is identical; bring your own deployment).

[Full roadmap.](PROJECT-PLAN.md)

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

## Docs

|   |   |
|---|---|
| [RFC: x-foxbook v1 for A2A AgentCard](docs/rfc-a2a-x-foxbook-extension.md) | The proposal upstream. |
| [User journey](docs/user-journey.md) | Five steps from "first heard" to "shipped in production." |
| [Distribution plan](docs/distribution.md) | The agent-hiring-gate framing. |
| [Pre-mortem](docs/pre-mortem-v1.md) | Top 5 ways v1 fails. Top 3 mitigations. |
| [Architecture decisions](docs/decisions/) | Six pinned ADRs. Do not re-open without a new ADR. |
| [Bench artifacts](ops/bench-results/) | The numbers, raw. |

---

## License

Apache 2.0. See [`LICENSE`](LICENSE).

The protocol is open. The **Foxbook** name has a trademark; see [`TRADEMARK.md`](TRADEMARK.md). Run your own log under your own name; the spec is the standard, not the host.

---

Built by [@cloakmaster](https://github.com/cloakmaster).
