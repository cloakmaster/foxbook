# Foxbook

**Verifiable agent identity for agent-to-agent infrastructure.** Open-source reference implementation of an agent-verification primitive: Ed25519 + RFC-9162-shaped Merkle transparency log + recovery-key revocation + JSON Schema interop.

**Live transparency log** — `https://transparency.foxbook.dev` ([`/root`](https://transparency.foxbook.dev/root) returns a signed tree head; cross-language verifiable). **Live evidence** — the log already caught a real handle-hijack attempt on 2026-04-24 ([`ops/evidence/2026-04-24-identity-guard-adversarial.md`](ops/evidence/2026-04-24-identity-guard-adversarial.md)).

**Canonical reference, not a marketplace.** Anyone can run a parallel deployment that satisfies the same protocol contracts (see [ADR 0006](docs/decisions/0006-protocol-not-marketplace.md)). The protocol shape is the authority; this repo is one implementation.

> **Status note (2026-04-28):** if `transparency.foxbook.dev` doesn't resolve yet, the canonical placeholder is `https://foxbook-transparency.inkog-io.workers.dev` while the CNAME lands. Both serve the same data.

---

## TL;DR

Every agent-to-agent call is an authorization decision. Today most callers skip the question — they read the AgentCard, dispatch the request, and trust the wire. Foxbook ships the runtime-safety primitive that makes the question explicit:

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const v = await verifyAgentCard(card, { requireFreshSTH: 3600 });
switch (v.status) {
  case "verified":         break;             // proceed
  case "unverified":       return refuse(v);  // hard block
  case "handle-mismatch":  return refuse(v);  // hard block — different handle
  case "stale-proof":      return warn(v);    // caller's risk policy
}
// ...dispatch the agent-to-agent call
```

Four discriminated outcomes, mapping to {allowed, blocked, blocked, warning}. **No numeric trust score.** Verification (objective, cryptographic) is kept strictly separate from reputation (subjective, deferred). Rationale in [ADR 0006 §4](docs/decisions/0006-protocol-not-marketplace.md).

---

## The agent hiring gate (problem statement)

Agent-to-agent infrastructure is shipping faster than the verification layer that anchors it. A receiving agent has no cryptographic basis for distinguishing:

1. The card published by the human owner of that handle.
2. A re-published card swapped by anyone who scraped the original.
3. A handle-spoofing attempt where the card claims an identity the publisher does not own.

The A2A spec gives agents a portable shape for *what they advertise*; it does not give them a portable shape for *how to prove who advertised it*. **Foxbook is that proof layer**, designed to slot under the existing A2A AgentCard extension surface (`x-foxbook` namespace) without breaking deployments that don't use it.

A2A-side proposal lives at [`docs/rfc-a2a-x-foxbook-extension.md`](docs/rfc-a2a-x-foxbook-extension.md). Filed upstream as a discussion in [a2aproject/A2A](https://github.com/a2aproject/A2A) — link to the discussion lands here once it's filed.

---

## Live demo — three curl commands

The transparency log is RFC-9162-shaped. Every endpoint serves real data; nothing is mocked. Substitute the placeholder URL above if `transparency.foxbook.dev` doesn't resolve yet.

```bash
# 1. Current signed tree head — proves the log is live + signed.
curl -s https://transparency.foxbook.dev/root | jq
# {
#   "log_id": "foxbook-v1",
#   "tree_size": 7,
#   "root_hash": "...",
#   "signed_tree_head": "<JWS>",
#   "published_at": "2026-04-27T..."
# }

# 2. First real leaf — agent-key-registration for handle "cloakmaster".
curl -s https://transparency.foxbook.dev/leaf/1 | jq
# {
#   "leaf_index": 1,
#   "leaf_hash": "...",
#   "leaf_data": {
#     "leaf_type": "agent-key-registration",
#     "did": "did:foxbook:01KPZ...",
#     "ed25519_public_key_hex": "...",
#     ...
#   }
# }

# 3. Inclusion proof for that leaf — verify it against /root with your
#    own Ed25519 implementation. Cross-language vectors at
#    schemas/crypto-test-vectors.json (jws_round_trip).
curl -s https://transparency.foxbook.dev/inclusion/1 | jq
# {
#   "leaf_index": 1,
#   "tree_size": 7,
#   "leaf_hash": "...",
#   "proof_hex": ["...", "...", "..."],
#   "root_hex": "..."
# }
```

If the recipient can re-hash the leaf preimage with our canonicalization rule and walk the proof to recover the root that matches `/root`, the log is verifiable end-to-end. **This is the 5-minute self-serve path** for verifying Foxbook is real, not a strategy doc.

---

## Quickstart

### Prerequisites

- `curl` + `jq` for the live-demo path (above).
- Node 22+ + `pnpm` if you want to run the workspace locally.
- An Ed25519 implementation in your language of choice for inclusion-proof verification (the cross-language test vectors at [`schemas/crypto-test-vectors.json`](schemas/crypto-test-vectors.json) let you confirm byte-for-byte round-trip).

### Verify a leaf today (direct HTTP API)

```bash
LEAF=1
ROOT=$(curl -s https://transparency.foxbook.dev/root | jq -r '.root_hash')
PROOF=$(curl -s https://transparency.foxbook.dev/inclusion/$LEAF)
LEAF_HASH=$(echo $PROOF | jq -r '.leaf_hash')
# Walk the proof: alternate hash with siblings per RFC 9162.
# Compare to $ROOT. If they match, the leaf is in the tree.
```

Reference Python verifier walkthrough lives in [`docs/user-journey.md`](docs/user-journey.md) Step 3. Reference Go verifier ships week-2 (filed in [`docs/pre-mortem-v1.md`](docs/pre-mortem-v1.md) Mitigation 2).

### Use the SDK (when implementation lands)

The TypeScript reference SDK signatures are committed at [`packages/sdk-claim/`](packages/sdk-claim/). Six functions; ~140 LOC public surface:

```typescript
// Claim primitives
import { claimStart, claimVerifyGist, claimRevoke } from "@foxbook/sdk-claim";

// Verification primitives + agent-hiring-gate wrappers
import { verify, foxbookVerify, verifyAgentCard } from "@foxbook/sdk-claim";
```

**Honest status:** function bodies currently `throw new Error("not implemented")`. **Implementation lands week 2** (per Day-7 PR #38 commit). The signatures + discriminated-union return types are committed today as the contract the upstream RFC + outreach DMs reference; if they shift in week-2, every artifact pointing at them goes stale. Filed as part of the Week-2 Distribution Track in [`docs/distribution.md`](docs/distribution.md) §4.

For verification today, hit the HTTP API directly per the live-demo section above.

### Run the workspace locally

```bash
git clone https://github.com/cloakmaster/foxbook.git
cd foxbook
pnpm install
pnpm -r test           # 173 in-process tests + 4 skipped (RUN_INTEGRATION_TESTS=1 gated)
pnpm check:core-isolation
pnpm check:generated   # types-ts/types-py drift-free against schemas/
```

The workspace structure mirrors the protocol layers — `core/` (service-agnostic primitives), `adapters/` (per-service integrations), `apps/api/` (claim flow), `apps/transparency/` (the read-only Cloudflare Worker), `packages/db/` (Drizzle + Postgres), `packages/sdk-claim/` (the reference SDK), `schemas/` (JSON Schema source of truth).

---

## Architecture

```
                     ┌─────────────────────────────────────┐
                     │  apps/transparency (Cloudflare      │
                     │   Worker — read-only)               │
   curl /root       ─┤  /root /leaf/:i /inclusion/:i      │
   curl /leaf/N      │  /consistency/:from/:to             │
                     └────────────┬────────────────────────┘
                                  │ reads
                                  ▼
                     ┌─────────────────────────────────────┐
                     │  Postgres (Neon) — append-only      │
                     │  tl_leaves + transparency_log +     │
                     │  claims + keys + revocations +      │
                     │  firehose_events                    │
                     └────▲───────────────────────────┬────┘
              writes      │                    LISTEN │
                          │                           ▼
        ┌─────────────────┴──────┐     ┌──────────────────────────┐
        │ apps/api (claim flow)  │     │ apps/api firehose        │
        │ /claim/start           │     │ listener (postgres-js    │
        │ /claim/verify-gist     │     │ LISTEN/NOTIFY) →         │
        │ /claim/verify-dns      │     │ /firehose SSE handler    │
        │ /claim/verify-endpoint │     │                          │
        │ /claim/revoke          │     │  curl /firehose →        │
        │                        │     │  data: {claim.verified}  │
        └────┬───────────────────┘     └──────────────────────────┘
             │ uses adapters
             ▼
   ┌─────────────────────────────────┐    ┌────────────────────────────┐
   │ adapters/gist (Tier 1, GitHub)  │    │ packages/sdk-claim (TS)    │
   │ adapters/dns (Tier 2, DoH)      │◄───┤ claim* + verify*           │
   │ adapters/endpoint-challenge      │    │ + verifyAgentCard wrapper  │
   │   (Tier 2, signed nonce)         │    │ (signatures only today)    │
   └─────────────────────────────────┘    └────────────────────────────┘
```

Service-agnostic core (`core/**` + `packages/**`) has zero adapter imports — enforced by `pnpm check:core-isolation`. Adding a new integration = zero core changes. Rule lives in [ADR 0001](docs/decisions/0001-service-agnostic-core.md).

---

## Status

### Live (real, verifiable today)

- ✅ Transparency log Worker — RFC-9162-shaped endpoints. Currently at `https://transparency.foxbook.dev` (with `https://foxbook-transparency.inkog-io.workers.dev` as the placeholder if canonical DNS hasn't propagated yet). Bench: [`ops/bench-results/2026-04-24-first-live-append.txt`](ops/bench-results/2026-04-24-first-live-append.txt).
- ✅ Tier-1 verification via GitHub Gist (with identity-guard at the URL-owner layer; `fetchCount === 0` on mismatch).
- ✅ Adversarial demo — handle-hijack attempt refused. Transcript: [`ops/evidence/2026-04-24-identity-guard-adversarial.md`](ops/evidence/2026-04-24-identity-guard-adversarial.md).
- ✅ Atomic revocation harness — `tx.delete(claims) + merkle.append(revocation_leaf) + firehose_events insert` proven end-to-end at 467ms wall-clock against live Postgres. Bench: [`ops/bench-results/2026-04-26-first-live-revocation.txt`](ops/bench-results/2026-04-26-first-live-revocation.txt).
- ✅ Firehose end-to-end — Postgres LISTEN/NOTIFY → in-process EventEmitter → SSE. **20ms median DB-COMMIT → SSE-receive latency** across 6 trigger-driven inserts. Bench: [`ops/bench-results/2026-04-27-firehose-latency.csv`](ops/bench-results/2026-04-27-firehose-latency.csv).
- ✅ Tier-2 DNS DoH adapter (8-way discriminated status: NXDOMAIN / SERVFAIL / TC / 429 / timeout / still-pending / identity-mismatch / match) + endpoint-challenge adapter (Ed25519 signed-nonce round-trip with replay defence). Handler-tested; live smoke is week-2.
- ✅ Cross-language verification primitives — `jws_round_trip` test vectors at [`schemas/crypto-test-vectors.json`](schemas/crypto-test-vectors.json). TS today; Python verifier round-trips against the same vectors.
- ✅ 173 in-process tests + 4 gated integration tests (`RUN_INTEGRATION_TESTS=1` against live dev DB) covering tx-context atomicity + verify-gist atomic-tx rollback proof + reconnect contract.

### Not yet live (week-2+ roadmap)

- ⏳ Canonical DNS for `transparency.foxbook.dev` (and `api.foxbook.dev`) — placeholder URL above until CNAME lands. Day-8 task.
- ⏳ SDK npm publish — signatures committed, bodies stubbed. Implementation week-2.
- ⏳ Live tier-2 smoke against a real domain — manual `curl` path works today; `smoke:tier2` script ships week-2 if needed.
- ⏳ Discovery API — week-2 milestone.
- ⏳ Firehose Durable Objects fanout (multi-subscriber production scale) — week-2+.
- ⏳ Tier-3 verification (GitHub Org + DMARC email) — week-2+.
- ⏳ Production load test — week-3 (validates the firehose <60s SLO under WAN conditions).
- ⏳ MCP server (`apps/mcp-foxbook-server/`) — Day-8+ candidate. Anthropic-MCP-side counterpart to the A2A RFC; closes the second half of the [ADR 0006](docs/decisions/0006-protocol-not-marketplace.md) §2 co-option defence.
- ⏳ A2A RFC formally accepted as registered extension — filed today as Discussion; namespace registration is up to the TSC.
- ⏳ Outreach DMs sent + first 10 verifier_run signals — Week-2 leading indicator per [`docs/outreach.md`](docs/outreach.md).
- ⏳ Multi-vendor federated logs — protocol contracts make alternate deployments byte-compatible; week-2+ adoption work.
- ⏳ Tier 4 (Sigstore) — explicitly OPTIONAL per `docs/foundation/LOCKED.md`; not on the critical path.

Roadmap detail in [`PROJECT-PLAN.md`](PROJECT-PLAN.md).

---

## Links

### Spec + design

- [Distribution plan](docs/distribution.md) — week-2 outreach + the agent-hiring-gate framing.
- [User journey](docs/user-journey.md) — 5-step path from "hears about Foxbook" to "integrated in production."
- [Pre-mortem v1](docs/pre-mortem-v1.md) — top 5 v1 demo failure modes + top 3 mitigation PRs.
- [RFC: x-foxbook v1 for A2A AgentCard extension](docs/rfc-a2a-x-foxbook-extension.md).
- [Outreach roster](docs/outreach.md) — 10 named targets, send-discipline rules.

### Architecture decisions (load-bearing; do not re-open without a new ADR)

- [ADR 0001 — Service-agnostic core](docs/decisions/0001-service-agnostic-core.md)
- [ADR 0002 — DB layer discipline (forward-only migrations, scripted db:migrate)](docs/decisions/0002-db-layer-discipline.md)
- [ADR 0003 — Foxbook enums live in JSON schemas, not generated TS types](docs/decisions/0003-foxbook-enums-as-schemas.md)
- [ADR 0004 — tl-leaf schema evolution + revocation atomicity + firehose emission inverse-lock](docs/decisions/0004-tl-leaf-schema-evolution.md)
- [ADR 0005 — Canonical bytes are written once, never re-derived](docs/decisions/0005-canonical-on-both-sides.md)
- [ADR 0006 — Protocol infrastructure, not marketplace](docs/decisions/0006-protocol-not-marketplace.md)

### Live evidence + bench artifacts

- [Adversarial demo (identity-guard refused handle-hijack)](ops/evidence/2026-04-24-identity-guard-adversarial.md)
- [First live append — leaf_index=1 / EdDSA STH JWS](ops/bench-results/2026-04-24-first-live-append.txt)
- [First live revocation — 467ms wall-clock](ops/bench-results/2026-04-26-first-live-revocation.txt)
- [Firehose latency — 20ms median DB-COMMIT → SSE](ops/bench-results/2026-04-27-firehose-latency.csv)

### Day-by-day retros (engineering log)

- [Day 5](docs/retros/day-05.md) · [Day 6](docs/retros/day-06.md) · [Day 7](docs/retros/day-07.md)

---

## Process notes

- **PR success criteria** — every PR body names the external success moment ([standard](docs/process/pr-success-criteria.md)).
- **Pre-commit gate** — biome + types regen drift check + core-isolation guard. No `--no-verify` ever.
- **Branch protection on `main`**: required CI checks, no force-push, no admin bypass. Direct pushes fail.

---

## License

Apache License 2.0 — see [`LICENSE`](LICENSE). All code in `core/`, `packages/`, `adapters/`, `apps/`, `schemas/`, and `docs/` is Apache-2.0-licensed.

## Trademark

**Foxbook** is a trademark; see [`TRADEMARK.md`](TRADEMARK.md) for use of the name. The protocol is open; the trademark is separate.

---

## Contributing

Day-by-day execution is happening at pace; external contributions are welcome but please open a Discussion first to align on scope. The locked architectural decisions in `docs/decisions/` are not up for re-litigation under time pressure — work that depends on overturning a pinned ADR needs a follow-on ADR proposal first.

For trademark licensing, security disclosure, or other inquiries: contact [@cloakmaster](https://github.com/cloakmaster).
