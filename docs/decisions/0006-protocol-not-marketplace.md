# ADR 0006 — Foxbook is protocol infrastructure, not a marketplace

**Number:** 0006
**Date:** 2026-04-26
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0001 (service-agnostic core), `docs/foundation/LOCKED.md`, `~/.claude/projects/-Users-tester-foxbook-port/memory/project_protocol_thesis_external_validation.md` (external review verdict received 2026-04-26).

## Context

Through week 1 a recurring strategic question kept resurfacing: should Foxbook lean toward a marketplace experience (curated UI, opinionated discovery, paid placement) to drive adoption faster, or should it stay protocol-shaped (open reference implementation, anyone-can-run, trust-via-cryptography-not-platform)? Internal LOCKED.md leans protocol; ad-hoc pressure has consistently pulled toward marketplace under tired-Benjamin reasoning ("we need a thing to demo, marketplaces are concrete, protocols are abstract"). LOCKED.md alone has not been authoritative enough to settle the question between sessions.

On 2026-04-26 an unbiased external review (independent third party, no prior Foxbook context) returned a sharp verdict: **protocol, not marketplace**, with three concrete refinements that the internal framing had missed. This ADR ratifies that verdict + the refinements into a binding architectural decision so future-tired-Benjamin can cite it instead of re-litigating the call.

## Decision

### 1. Foxbook is protocol infrastructure for verifiable agent identity.

`foxbook.dev` is the **canonical reference implementation** of the protocol — not the only one. Anyone can:

- Run their own transparency log (`apps/transparency` Cloudflare Worker is a reference; the contract is `/root` + `/leaf/:index` + `/inclusion/:index` + `/consistency/:from/:to`, RFC 9162-shaped).
- Run their own scouts (`apps/scouts/*` skeleton in repo; reference roster mapped in `research/scout-roster.md`).
- Run their own claim-flow verifier (the JWS/canonical-bytes/Merkle primitives live in `core/` and are intentionally service-agnostic per ADR 0001).

The protocol-shaped surfaces are the schemas (`schemas/*.json`), the canonical-bytes rule (ADR 0005), the leaf taxonomy (ADR 0004), and the discovery / firehose envelope contracts (`schemas/envelope/v1.json`). Anyone implementing those surfaces correctly produces an interoperable Foxbook node. There is no Foxbook-specific authentication required to participate.

### 2. The failure mode is co-option, not forking.

External validation's load-bearing observation: forking a transparency log is structurally low-credibility. **Trust history is per-leaf and non-transferable.** A fork can copy the code, but it can't copy the audit trail — every existing scout's inclusion proofs reference the canonical log's leaf hashes, and re-issuing those would invalidate every proof ever published. So forks die on first contact with the question "why should I trust this fork's leaves more than the original log's leaves?"

The real failure mode is **co-option by adjacent incumbents**:

- **Anthropic ships native identity inside MCP** — the MCP protocol gains its own first-party agent-verification surface. Foxbook becomes redundant for any developer already in the MCP ecosystem.
- **Google ships an internal A2A verification layer** — the A2A spec absorbs verification semantics directly. Foxbook's `x-foxbook` extension is pre-empted before it can register as an upstream A2A extension.
- **Both happen** — Foxbook becomes a third-party detail that nobody with primary platform tooling needs.

Defence: ship the reference implementation FIRST, get it referenced by the MCP and A2A spec authors, become the obvious thing they point at instead of building parallel infrastructure. The 6-month adoption test (PROJECT-PLAN.md Week-2 Distribution Track) is the leading indicator that this defence is working.

### 3. Monetization is deferred to enterprise audit/compliance, not v1 marketplace.

The natural Foxbook business model is NOT marketplace fees, NOT closed-source SaaS, NOT paid placement. It is:

- **SR 11-7 model risk management** — banks and large financial institutions deploying agents need an auditable substrate. Foxbook's transparency log + revocation flow IS that substrate; SR 11-7 attestations point at it.
- **EU AI Act agent governance** — verifiable agent provenance is a compliance requirement under the AI Act's accountability provisions for high-risk deployments. Foxbook's leaf taxonomy + recovery-key revocation gives regulated entities the auditable surface they need.
- **Cyber-insurance underwriting** — agent-mediated transactions create a new insurable surface. Underwriters need a verifiable history of which agent acted on whose behalf. Foxbook's append-only log is the underwriting substrate.

These converge on **hosted-log-as-a-service + enterprise audit/compliance tooling** at month 12+, gated on protocol canonicality being the precondition. This matches the Inkog-era demand surface Benjamin already understands; it is NOT a generic enterprise pivot, it is the specific demand surface that Foxbook's primitives naturally serve.

This is filed as PROJECT-PLAN.md's 12-month business test. If 12 months in, protocol canonicality is established but no enterprise audit/compliance demand has materialised, the thesis is wrong; pivot or wind down.

### 4. Path ordering is irreversible — protocol-now leaves marketplace-later open; marketplace-now closes the protocol door permanently.

This is the load-bearing rule of the ADR.

- **Protocol-now → marketplace-later is reversible.** A canonical reference implementation with broad adoption can support an opinionated marketplace UI built on top (someone — possibly Foxbook itself — ships `foxbook.dev/marketplace` later). The protocol's trust assumptions (transparency log, recovery-key signatures, leaf-byte immutability) propagate cleanly into the marketplace's product contract. Existing scouts/agents/claims continue working unchanged.
- **Marketplace-now → protocol-later is NOT reversible.** A marketplace operator sets per-platform trust assumptions: "agents are who Foxbook says they are, and Foxbook is the source of truth." Once a meaningful number of transactions assume this, those trust assumptions cannot be re-derived as protocol-level guarantees without breaking every existing transaction. The marketplace's reputation system, fee structure, and platform-mediated trust become load-bearing for the existing customer base; you can't extract them after the fact.

The asymmetry is structural. Future-tired-Benjamin will be tempted to "just add a marketplace UI to drive adoption faster" and the cost of that move will not be visible until after the marketplace's trust assumptions are baked in. This ADR exists to make the cost visible BEFORE the move.

### 5. Explicit out-of-scope (will not ship in v1; require ADR amendment to revisit)

- **Closed-source moat.** All `apps/`, `core/`, `packages/`, `adapters/`, `schemas/` are MIT/Apache-shaped open source. Foxbook's value is not "we wrote the code" but "our reference log is the canonical one with the longest audit trail."
- **Marketplace UI.** No discovery UI that ranks agents by paid placement. No "verified by Foxbook" paid badge. The Discovery API (`/api/v1/discover`) returns ranked results based on objective criteria (claim tier, leaf age, capability match), not paid signal.
- **Agent-side payment rails in v1.** x402 / AP2 / MPP adapters exist (per `adapters/`) so agents CAN transact, but Foxbook does not mediate or take a cut. The firehose surfaces transactions; it does not facilitate them.
- **Forced onboarding.** No "to use Foxbook you must register an agent on foxbook.dev." The pre-pop scraper writes shadow URLs (tier=0); agents claim them when ready. Agents who never claim still appear; the directory is descriptive, not gatekept.
- **Walled-garden discovery.** The Discovery API is publicly readable, anonymous, no rate-limit-required-API-key. Anyone can run their own discovery surface against the same data.

## Enforcement

- **Code review** — any PR proposing work in the out-of-scope list above MUST reference this ADR in the body. Reviewers refuse the PR or insist on an ADR amendment first.
- **PROJECT-PLAN.md Week-2 Distribution Track** — adoption-pipeline work (RFC to A2A repo, sdk-claim scaffolding, named outreach) is the operational expression of this decision. Slipping all three is a co-option-failure leading indicator.
- **6-month adoption test** (PROJECT-PLAN.md): at least one of (MCP docs reference / A2A spec mention / framework SDK integration / named adoption by a real agent-builder shop) by month 6. Zero at month 4 = co-option failure mode materialising; pivot signal.
- **12-month business test** (PROJECT-PLAN.md): hosted-log-as-a-service + enterprise audit/compliance tooling is the protocol-canonicality monetization seam. Zero pipeline at month 9 = monetization thesis wrong; rethink.

## Consequences

- Discovery, claim, firehose, and transparency surfaces stay open + unauthenticated. No Foxbook-specific API keys for read paths.
- The `foxbook.dev/live` demo continues to be the load-bearing v1 artifact (firehose p95 <60s — see LOCKED.md), but it is described as "the public, real-time view of the canonical reference log," not "the Foxbook marketplace."
- Adoption work (Week-2 Distribution Track) is a first-class engineering deliverable, not a marketing afterthought. The RFC to the A2A spec authors is treated as protocol infrastructure work.
- The hero outreach pipeline (`research/scout-roster.md` + 100 pre-claim target by day 14) is reframed: not "marketplace seed," but "credible reference deployers who run their own scouts and reference our log." The narrative differs; the names overlap.

## Alternatives considered

- **Marketplace-first with protocol-later.** Rejected per §4 — the path is irreversible. Once trust assumptions are platform-mediated, they cannot be re-derived as protocol-level guarantees without breaking the existing customer base.
- **Closed-source reference + open-source SDK only.** Rejected — defeats canonicality. A closed-source canonical log is structurally indistinguishable from any other proprietary identity provider; the trust story collapses.
- **No reference implementation; spec only.** Rejected — empirically, specs without a reference implementation get ignored by ecosystem participants ("show me the canonical example or I won't bother"). The reference is what makes the spec real.
- **Hybrid: protocol public, monetization via paid x402-style fees on firehose listening.** Rejected — sets up a "free tier" / "paid tier" mental model that pressures every protocol decision toward the paid tier's needs, which is exactly the marketplace failure mode dressed differently.

## When this rule can be violated

Only via an ADR that supersedes 0006. The amendment must address:

1. The path-ordering asymmetry (§4) — what specifically makes the irreversibility claim wrong?
2. The co-option failure mode (§2) — has it been resolved (e.g. MCP / A2A authors have referenced foxbook.dev as canonical), or is the amendment proposing to acknowledge it?
3. The Inkog-era monetization wedge (§3) — has the demand surface been falsified by 12-month evidence, or is the amendment proposing a different wedge?

If a future ADR can speak to all three with concrete evidence (not strategy notes), it can supersede 0006. Until then, this ADR governs.

## Verified

- External review verdict received 2026-04-26 from an unbiased third party with no prior Foxbook context. The review's three sharpenings (co-option not forking, SR 11-7 / EU AI Act / cyber-insurance underwriting, path-ordering irreversibility) are captured in the project-memory file referenced above.
- LOCKED.md's protocol bias is consistent with this ADR; ADR 0006 makes the underlying reasoning explicit + binding rather than implicit.
- PROJECT-PLAN.md Week-2 Distribution Track + 6-month adoption test + 12-month business test operationalise this ADR's tests.
