# 🦊 Foxbook

Verifiable agent identity for A2A and MCP.

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const v = await verifyAgentCard(card);
if (v.status !== "verified") return refuse(v);
// safe to dispatch
```

Open source. Apache 2.0. Run your own log; the protocol contract is what makes you interoperable.

[**Live demo**](#live-demo) · [**Why**](#why) · [**Status**](#status) · [**RFC**](docs/rfc-a2a-x-foxbook-extension.md) · [**Roadmap**](PROJECT-PLAN.md)

---

## Live demo

The log is real. One curl proves it.

```bash
curl -s https://transparency.foxbook.dev/root | jq
```

Returns a signed tree head. Walk `/inclusion/:i` against `/root` and you have a verifiable Merkle inclusion proof. RFC 9162-shaped, no auth, no API key.

An adversarial test of the identity guard, refused before any network I/O. `fetchCount === 0` at the adapter. [Read the transcript.](ops/evidence/2026-04-24-identity-guard-adversarial.md)

---

## Why

A receiving agent reading an AgentCard has no cryptographic basis for trusting the handle field. Foxbook fixes that.

`verifyAgentCard(card)` returns one of four outcomes:

- `verified` → proceed
- `unverified` → block
- `handle-mismatch` → block (the card claims a handle the log doesn't attest)
- `stale-proof` → caller's risk policy (refresh, retry, warn)

That's the whole verification surface. No trust score. No reputation field. Identity goes here; reputation goes in a layer above.

---

## Status

**Live**

- Transparency log on Cloudflare Workers, signed tree head per append, consistency proofs.
- Tier-1 verification via GitHub Gist, with an identity guard at the URL-owner level.
- Tier-2 via DNS TXT (Cloudflare DoH) and signed-nonce endpoint challenge.
- Recovery-key signed revocation, atomic across leaf append and claim delete. Postgres revocation observed at 467ms wall-clock (single-run benchmark).
- Firehose commit-to-receive latency: 20ms median (single-run benchmark).
- 173 in-process tests, 4 gated integration tests.

**Not yet live**

- SDK npm publish (signatures committed; implementation in progress).
- MCP server (in progress).
- Production WAN load test (planned).
- Multi-vendor federated logs (the protocol contract is identical; bring your own deployment).

[Full roadmap.](PROJECT-PLAN.md) [Day-by-day retros.](docs/retros/)

---

## Quickstart

Verify a leaf, no install:

```bash
curl -s https://transparency.foxbook.dev/inclusion/1
curl -s https://transparency.foxbook.dev/root
```

Walk the proof per RFC 9162. Your verifier in any language should produce byte-identical output against the cross-language test vectors at [`schemas/crypto-test-vectors.json`](schemas/crypto-test-vectors.json).

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

The protocol is open. The **Foxbook** name has a trademark; see [`TRADEMARK.md`](TRADEMARK.md). Run your own log under your own name with our blessing; the protocol contract is what makes you interoperable.

---

Built by [@cloakmaster](https://github.com/cloakmaster). Engineering log lives in the retros.
