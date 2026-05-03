# ADR 0006 — Protocol-not-marketplace: path-ordering rule + co-option failure mode

**Number:** 0006
**Date:** 2026-04-26
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0001 (service-agnostic core), ADR 0004 (tl-leaf schema evolution), ADR 0005 (canonical bytes once)

## Context

By Day 6 of build, two architectural pulls were visible. One was protocol shape: ship the spec, the schemas, the canonical-bytes test vectors, the transparency log, the SDK — interop primitives any party can implement against. The other was marketplace shape: ship a hosted service that brokers verification, charges per call, owns the directory. Both shapes can be built from the same code that exists today. They diverge structurally on the second move, not the first.

An external review on 2026-04-26 (unbiased, requested specifically to stress-test the strategic frame before week 2 commits to a public direction) made two architectural points sharp enough to warrant an ADR. They are recorded here because the README, TRADEMARK.md, and downstream design choices already lean on these decisions; without an ADR the rationale lives only in conversation history and degrades.

## Decision

### 1. Protocol-not-marketplace path-ordering rule

The two paths — protocol-first vs marketplace-first — are **asymmetric and irreversible**:

- **Protocol-now leaves marketplace-later open.** A working open spec + reference impl + test vectors can be commercialized later (hosted SLA, support contracts, enterprise verification API, certification program) without rewriting the architecture. The marketplace lives in a layer above; the protocol surface beneath it stays untouched.
- **Marketplace-now closes protocol-ever.** A hosted-first project that owns the directory + monetizes per-call verification builds incentive structures (revenue dependence on lock-in, enterprise customers expecting proprietary features, sales motion privileging closed integrations) that structurally prevent re-opening the protocol later. Even with intent, the path doesn't reverse without burning the commercial relationships that funded it.

**Foxbook ships protocol-now.** Marketplace-shape moves are forbidden until/unless an ADR explicitly supersedes 0006 — and any such ADR must justify why the path-asymmetry has changed (e.g., the open-source landscape has filled the protocol slot and Foxbook needs to move up the stack to remain relevant).

### 2. Co-option (not forking) is the failure mode

The protocol-shape strategy is sometimes critiqued with a "competitor forks the spec under their name" worry. That is **not** the failure mode for an Apache 2.0 transparency-log primitive. Forks running the same protocol contracts are a feature, not a bug — multi-vendor federated logs is on the README's roadmap.

**The actual failure mode is co-option:** a larger entity adopts the spec while blunting the open-protocol guarantees. Concretely:

- An incumbent ships a "compatible" implementation that's actually proprietary at the points that matter (closed source for revocation logic, undocumented schema extensions, opaque audit-trail behavior under failure).
- A standards body absorbs the spec into a broader framework whose governance lets the broader framework's other components dilute the openness guarantees.
- A vendor offers "Foxbook-compatible identity" as a managed service whose customers can't audit the log, can't run their own deployment, can't switch — interop on paper, lock-in in practice.

In all three cases the spec name lives, the protocol semantics die. Forks under different names compete on merit; co-option steals the name and discards the merit.

**Defense indicators are cross-implementation references that name the canonical impl.** Specifically:

- Other implementations' public docs / RFCs / spec proposals that cite Foxbook by name as the reference impl for the identity-layer slot in their architecture.
- Harness aggregators / interop registries that list Foxbook with the canonical role designation (e.g., `claim_type_layer: identity` on AgentGraph's interop-harness).
- Cross-impl test-vector byte-match validation against Foxbook's canonical bytes (the CTEF v0.3.1 byte-match report is the first such artifact).

Each cross-impl reference raises the cost of co-option: an incumbent that forks-and-blunts has to either (a) replicate the references (expensive, slow, signals exactly the lock-in attempt) or (b) live alongside them (in which case the references continue to point at the original).

The strategic implication: cross-impl reference cycles are the load-bearing protective mechanism, not features or marketing.

## What this ADR does NOT decide

The 2026-04-26 review also discussed a **monetization-wedge framing** that proposed SR 11-7 (model risk management) / EU AI Act Article 12 / cyber-insurance compliance as the entry point for revenue if/when Foxbook moves up the stack. That framing — internally tagged "Wedge 1" — is **not ratified by this ADR**.

Reason: the wedge framing was discussed during the same 2026-04-26 review but was **rejected on 2026-04-30**, four days after this ADR's date. Backdating retrofitted wedge rationale into a doc dated 2026-04-26 would falsify the decision record. The ADR mechanism only works if dated docs are honest about what was decided when.

If a future ADR wants to revisit monetization framing — under SR 11-7, AI Act Article 12, cyber-insurance, or any other wedge — it lives at its own number with its own date. ADR 0006 is silent on commercial direction beyond the path-ordering constraint above.

## Enforcement

- **Code review.** Any PR that introduces marketplace-shape primitives (per-call billing surfaces, account hierarchies for paying customers, closed-source verification logic, proprietary schema extensions, lock-in mechanisms) must reference this ADR in the PR body and justify why the path-asymmetry has shifted. The default answer is no.
- **`docs/RATIONALE.md`** carries the narrative summary of this ADR for stranger-readers; ADR 0006 itself is the contract.
- **TRADEMARK.md** already encodes the co-option-defense mechanism at the brand layer: trademark protection prevents a third party from running a co-opting service under the Foxbook name. Apache 2.0 + trademark-protected name is the canonical co-option-defense pattern (Linux + Linux trademark; PostgreSQL + PostgreSQL trademark).
- **README's "Multi-vendor federated logs" line** under "Not yet live" encodes the forks-are-fine corollary. Do not soften that line.

## Consequences

- The roadmap is frozen at protocol shape until/unless 0006 is superseded. Marketplace-flavored asks (hosted SLA, paid verification API, certification program, "Foxbook Cloud") are filed-not-actioned by default.
- Cross-impl engagement (Discussion threads, harness aggregator entries, byte-match interop validation, cross-spec citation) is treated as **load-bearing strategic activity**, not as marketing nice-to-have. Time spent producing harness aggregator entries or responding to spec discussions is on-strategy regardless of immediate adoption metrics.
- Apache 2.0 + Foxbook trademark stays. The license is for the code; the trademark is for the brand. Anyone forking under a different name is welcome; using the Foxbook name in association with a derived service requires written permission per TRADEMARK.md.
- Direct revenue from Foxbook is structurally absent under this ADR. Revenue, if it ever happens, lives in a future-ADR layer above the protocol (services, support, certification) — not in the protocol itself.

## Alternatives considered

- **Marketplace-shape primary, protocol-shape as marketing surface.** Rejected per the path-asymmetry rule. The path doesn't reverse cleanly.
- **Hybrid: protocol-shape today, marketplace-shape after 6-month measurement window.** Rejected as a comforting fiction. The structural commitments that make marketplace-shape work (revenue, sales, lock-in incentives) accumulate during the "measurement window" and become unwindable. The path-ordering is unconditional, not gated on adoption metrics.
- **Closed-source proprietary identity-verification SaaS.** Rejected upfront as ideologically and architecturally incompatible with the transparency-log thesis. A transparency log whose contents you can't audit is not a transparency log.
- **Open-source code + closed-source spec.** Rejected: the spec is the standard. Closing it forfeits the cross-impl reference cycle that defends against co-option.

## When this rule can be violated

Only via an ADR that supersedes 0006. Concrete scenarios that would warrant a new ADR:

1. **The protocol-slot has been filled by another open-source primitive.** If a different open identity-layer primitive achieves dominant cross-impl reference status, Foxbook may need to either deprecate or move up the stack to remain relevant. New ADR explains why protocol-now no longer leaves marketplace-later open *for Foxbook specifically*, even though the path-asymmetry rule remains generally true.
2. **A regulatory forcing function changes the shape of the open-source vs hosted-service tradeoff.** E.g., a future regulation requires identity-verification audit trails to be operated by licensed entities. New ADR would document the regulatory landscape that closes the marketplace-later option unless it's exercised now.
3. **A funder explicitly requires marketplace-shape as a condition of funding** (and Foxbook accepts the funding). New ADR would document the explicit tradeoff.

In all three cases the new ADR documents the path-ordering exception rather than retracting the rule.

## Verified

- README.md's "Why" section frames the primitive as cryptographic, public, and free — protocol-shape language, not marketplace-shape.
- TRADEMARK.md's "Why the trademark is separate from the source license" section encodes the co-option-not-forking failure mode at the brand layer.
- Apache 2.0 LICENSE is committed; protocol contracts (RFC 9162-shaped endpoints, JSON Schemas in `schemas/`, cross-language test vectors) are open.
- Cross-impl reference status: registered as `evidence_provider` on the identity-layer slot at `https://agentgraph.co/.well-known/interop-harness.json` with byte-match validation against CTEF v0.3.1 vectors (4/4, commit 9e392c5). First load-bearing co-option-defense indicator per §2.
