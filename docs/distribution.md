# Distribution — Week-2 plan

Operationalises [ADR 0006 — protocol-not-marketplace](decisions/0006-protocol-not-marketplace.md). Foxbook gets adopted by being the obvious reference implementation that MCP / A2A / framework-author roadmaps point at — not by running the only marketplace.

---

## §1 — The agent hiring gate (headline use-case)

Every agent-to-agent call is an authorization decision. The pattern we're shipping makes the question explicit:

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const v = await verifyAgentCard(card, { requireFreshSTH: 3600 });
if (v.status !== "verified") return blockOrWarn(v);
// ...dispatch the agent-to-agent call
```

The four discriminated outcomes map to **{allowed, blocked, blocked, warning}**:

- `verified` → allowed
- `unverified` → blocked (no claim attesting this card)
- `handle-mismatch` → blocked (the card claims a handle the transparency log does NOT attest)
- `stale-proof` → warning (caller's risk policy decides)

**No numeric trust score.** Aggregate scoring conflates verification (objective, cryptographic) with reputation (subjective, deferred); the boundary stays clean. Future planners cannot re-propose without an ADR amendment to ADR 0006 §4.

This is the runtime-safety primitive every framework author already needs. The hiring-gate framing is what every Distribution Track artifact (RFC, outreach DMs, this doc, the Day-8 MCP server) anchors around.

## §2 — Headline evidence: the cloakmaster vs samrg472 identity-guard demo

On 2026-04-24, we tried to hijack a GitHub handle through the Foxbook claim flow. Foxbook refused with `409 identity-mismatch` — and crucially, **`fetchCount === 0` at the adapter**. The identity check ran against the URL's path username before any network I/O; the mismatch with the claim's `asset_value` terminated the flow before any Gist content was read.

Full transcript at [`ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md`](../ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md). This is not a hypothetical attack — it's an actual real-handle-against-real-handle attempt that the live reference verifier blocked structurally.

Why this matters for Distribution: when an MCP / A2A / framework-author asks "why your verification layer and not the one I'm about to write," the answer is "because my live transparency log already caught a real handle-hijack attempt."

## §3 — Audience (week-2 outreach targets)

The Week-2 Distribution Track operates against four audience lanes; named targets in [`outreach.md`](outreach.md):

1. **MCP team contacts** — Anthropic-side MCP protocol authors + early adopters.
2. **A2A spec maintainers** — Google's A2A AgentCard spec working group.
3. **Framework authors** — LangGraph, CrewAI, AutoGen, Mastra. The agent-hiring-gate slots into their core dispatch loop.
4. **Agent-security analyst voices** — independent researchers + analysts whose write-ups influence framework choices.

The narrative is identical across all four: *"I built the reference implementation of the verification layer your spec assumes — and the live transparency log already caught a real handle-hijack attempt."* Offer-of-work-already-done, not request-for-attention.

## §4 — SDK as hypergrowth leverage

The reference SDK is at [`packages/sdk-claim/`](../packages/sdk-claim) — six functions, ~130 LOC public surface. **Tight enough that the RFC + outreach DMs + this doc all reference it as the contract**; signatures are stable in week 2, only bodies fill in.

```typescript
import {
  claimStart, claimVerifyGist, claimRevoke,    // claim primitives
  verify, foxbookVerify, verifyAgentCard,      // verification primitives + wrappers
} from "@foxbook/sdk-claim";
```

`verifyAgentCard` is the load-bearing entry point — it's the agents-first onboarding surface. A framework author dropping it before each agent-to-agent dispatch gets the entire verification layer in one line, with discriminated outcomes that map cleanly to allow/block/warn policy.

Day-7 PR E ships the signatures + discriminated unions. Week-2 ships the implementation. The implementation is small (~150-200 LOC of fetch + JWS-verify glue per function); the surface design is the load-bearing decision.

## §5 — RFC to the A2A spec

[`docs/rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) is upstream-PR-shaped text proposing `x-foxbook` v1 as a registered A2A extension. The pitch: A2A's AgentCard tells you *what* an agent advertises; `x-foxbook` tells you *how to verify who advertised it*. Submitted to the A2A repository by end of week 2; this doc references the live deployment URLs + cross-language test vectors + revocation evidence so the spec authors can verify in <5 minutes that this is real, not a strategy doc.

The RFC explicitly does NOT propose:
- marketplace UI changes to A2A,
- paid placement,
- closed-source dependencies,
- forced `x-foxbook` adoption.

It proposes an *option* for verifiable provenance. Framework authors who want it can wire it; framework authors who don't continue to work unchanged.

## §6 — MCP server (Day 8 — NOT this PR)

`apps/mcp-foxbook-server/` is the Anthropic-MCP-side counterpart to the A2A RFC. Three tools at v1:

- `foxbook_verify_agent(handle)` — handle → `{tier, revoked, did, leafIndex}`
- `foxbook_get_inclusion_proof(leaf_index)` — proof + STH
- `foxbook_check_revocation(did, ed25519_public_key_hex)` — revoked? + revocation_leaf_index

Submitted to Anthropic's MCP registry. Closes the Anthropic-MCP half of ADR 0006's co-option failure mode (the A2A half is the RFC). Both must ship for the co-option defence to be coherent.

**Day 8 candidate per PROJECT-PLAN.md Cross-LLM Strategic Feedback** — ~200-400 LOC, deserves its own day, NOT bundled into PR E.

## §7 — Week-1 demo path

The week-1 demo audience is MCP / A2A / independent agent builders who claim via GitHub handles. Tier-1 (Gist via GitHub handle) is the load-bearing path. The headline artifact is the **adversarial demo** (§2) — `cloakmaster → samrg472` identity-guard refusal — captured at `ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md`.

The scraper is explicitly DEFERRED — pre-pop scraper skeleton (`apps/scrapers/github/`) is not on the week-1 critical path. The narrative works on adversarial-demo evidence + reference SDK + RFC text alone; the scraper adds value once we have written demand for shadow-claim discovery, which we don't yet.

## §8 — Week-2 leading indicator (Abandon Trigger gate)

**10 external verifier runs against the live transparency log within the first 5 minutes of receiving a DM, zero follow-up Q&A** — by end of week 2.

Tracked per-target in [`outreach.md`](outreach.md) under the `verifier_run` column. 10 of 10 = signal that the agent-hiring-gate framing + reference SDK + adversarial demo are landing. <10 of 10 by end of week 2 = the framing isn't carrying its weight; rethink before doubling down.

This indicator is operationalised per [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers. It's NOT a vanity metric — the threshold is "verifier ran in 5 minutes without hand-holding," which means the SDK + docs are clear enough that the recipient can self-serve. The clarity is the load-bearing thing.

## §9 — What hypergrowth looks like for protocol infrastructure

Adoption is not seats; adoption is *references*. The Week-2 Distribution Track succeeds when:

- One of MCP / A2A / a real framework points at `foxbook.dev` (or the protocol's reference implementation contract) in their docs.
- One real agent-builder shop publishes a `verifyAgentCard` integration in their dispatch loop.
- The verifier runs without Foxbook hand-holding from at least 10 named external operators.

Failure mode (per ADR 0006 §2): co-option. MCP ships native identity OR Google ships an internal A2A verifier OR both. The defence is shipping FIRST and being the obvious thing to point at. Week-2 is that landing window.

---

## References

- ADR 0006 — protocol-not-marketplace (load-bearing)
- ADR 0001 — service-agnostic core
- PROJECT-PLAN.md — Week-2 Distribution Track + Abandon Triggers + 6/12-month tests
- RFC text — [`rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md)
- Outreach roster — [`outreach.md`](outreach.md)
- Reference SDK — [`packages/sdk-claim/`](../packages/sdk-claim)
- Adversarial demo — [`ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md`](../ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md)
- Live transparency log — `https://foxbook-transparency.inkog-io.workers.dev` (placeholder until canonical DNS lands)
