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

## When this fires

You're building a flow with LangGraph or CrewAI. Your agent needs to hand work off to another agent it didn't write — found through a directory, a marketplace, or a referral. The other agent's card says `handle: @somebody-trustworthy`. That's just a string. Anyone can write anything there. If you call the other agent before checking, the work goes to whoever wrote the handle, not whoever owns it.

`verifyAgentCard(card)` is the check before the call.

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

So I built it in nine days. The log above is live. The adversarial test of the identity guard refused a fake claim before any network call. If it's useful, run your own log. If something breaks, file an issue.

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
