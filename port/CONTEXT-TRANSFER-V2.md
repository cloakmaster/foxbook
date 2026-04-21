# Foxbook — Context Transfer V2

**Purpose:** Everything a new Claude instance needs to pick up exactly where the prior two sessions left off. Read this document first, in full, before doing anything else.

**Last updated:** April 21, 2026
**Status:** Foundation doc + LOCKED.md are finalized. All five review patches applied. Ready for week 1 engineering. No open design questions remain — only build execution and the week-1 probes listed in the foundation doc §18.

---

## 0. Reading Order for the New Instance

1. **This file** (`CONTEXT-TRANSFER-V2.md`) — you're reading it. Sets the meta, tone, decisions, and arc.
2. **`LOCKED.md`** — one-page pin of all commitments, SLOs, abandon triggers, and decision rules. Fits in one read. Reference this when ANY design question arises mid-build.
3. **`foxbook-foundation.md`** — the authoritative 18K+ word foundation document. 19 sections. Everything is here. Read it fully before writing any code.
4. **`research-findings.md`** — single source-of-truth research synthesis across two research rounds. Has flag blocks (§0) for pending verifications. Consult when a research question arises.

**Optional / background (read only if context is needed on how decisions were made):**
- `00-CONTEXT-TRANSFER.md` — the V1 context transfer from session 1 to session 2. Superseded by this file but shows the decision arc from the early thesis through the Gemini grill.
- `01-foundation-doc-v1.md` — the original "Sigil"-branded foundation doc. **STALE. DO NOT USE.** Superseded entirely by `foxbook-foundation.md`.
- `02-gemini-grilling.md` — Gemini's adversarial review of the V1 doc. All load-bearing critiques were adopted into the current foundation doc.
- `03-deep-research-prompt.md` — the 4-question deep research prompt Benjamin ran externally. Results synthesized into `research-findings.md`.
- `research-findings-web-scan.md` — Claude's web-scan findings on the same 4 questions. Merged into `research-findings.md`.
- `README.md` — bundle overview from session 1.

---

## 1. Who You're Talking To

**Name:** Benjamin
**Email:** benshiib@gmail.com
**Role:** Solo founder

**Background:**
- Built **Inkog** — launched, posted to Reddit/HN, did NOT get traction. Lesson baked into Foxbook: virality must come from product mechanics (firehose screenshots, first-cent emails, OG images), not from manual human posting. HN/Reddit/PH launches are supplementary, not load-bearing.
- Built **DeskDuck** — voice-first AI action assistant. Currently parked. Foxbook is a new product. **Zero code reuse from DeskDuck.** One rule carried over: the service-agnostic core architecture (now committed in §17 of foundation doc).
- Went through **9+ rounds of deep research** before converging on Foxbook. Tests ideas aggressively and rejects framings that don't hold up.

**Communication style — READ THIS CAREFULLY:**

- **BRUTAL HONESTY.** He has asked for this explicitly and repeatedly. Do not soften. Do not hedge. Do not fence-sit.
- **COMMIT.** Pick a lane. "Here are three options" is worse than "Here's what I think you should do and why, though option B could work if X." He changes his mind when pushed back on with reasoning. He does not want a yes-man.
- **Respects pushback.** If he's wrong, say so with reasoning. He conceded multiple times across both sessions when Claude pushed back correctly.
- **Reads adversarial reviews and expects real engagement.** He ran the foundation doc past Gemini for an adversarial grill. He expects you to process external critiques seriously — concede what's right, push back on what's wrong, not diplomatically agree with everything.
- **Speed and decisiveness.** Founder mode. Signal over volume.
- **Minimal formatting in casual replies.** Don't over-bullet. Prose when prose works. Bullets when multi-point structure is warranted.
- **NO enterprise-speak.** Culture is solo founder, vibe coder, Hugging Face / Figma / Lovable / Moltbook ecosystem vibes. Not B2B SaaS. Not "leveraging synergies." Not "compliance-as-a-service."
- **Budget sensibility:** $1-2K/month on infrastructure (scout agents) is approved. Everything FREE for users in V1. No paid tiers until V3.
- **4–6 week focused build is committed.** He explicitly rejected a "2-3 week weekend sprint" framing in session 1 as too rushed and too small.
- **Doesn't fear confrontation.** His posture on Meta/Moltbook: not afraid. Still runs the parasitic loop. Demotion to optional is an operational reliability call, not timidity.

**Quote that captures his philosophy:**
> "At the end of the day, if you deeply think what agents and users care about today and in the future, you will know the answer on how we can make this TRULY fascinating and groundbreaking."

---

## 2. What Foxbook Is (Locked, 12/10 Confidence)

**Foxbook is the Agent Work Exchange** — a cross-platform, neutral, cryptographically-verified directory and marketplace where AI agents hire other AI agents.

Pitch: **"List your agent. It starts getting work."**

**Domain:** foxbook.ai
**Mascot:** a fox (geometric, sharp, confident — not cartoonish)

### The thesis in three sentences

Agents are about to specialize and delegate at scale. Every multi-agent system needs discovery, identity, reputation, and settlement. There is no cross-network neutral layer for this. Foxbook is that layer.

### What Foxbook is NOT (do not drift)

- Not an identity registry (it's a work exchange; identity is infrastructure, not the product).
- Not a scanner or security tool.
- Not an enterprise compliance SKU.
- Not a passport file.
- Not B2B SaaS.

---

## 3. What Was Built Across Two Sessions

### Session 1 (April 15, 2026)
- Thesis convergence from 9+ research rounds → locked at 12/10.
- Gemini adversarial grill → 5 load-bearing critiques adopted (Class/Instance, Agentic Turing Test, namespace rooting, auth+payment in manifest, demand-side enforcement reframed as devtool).
- Deep research prompt written (`03-deep-research-prompt.md`) and sent to external tools.
- Original foundation doc V1 written (now stale — `01-foundation-doc-v1.md`, "Sigil" branded).
- Key architectural decisions locked: Ed25519 + JWS + Merkle log (not Sigstore primary), A2A AgentCard base manifest, x402 canonical rail, verified-asset namespace rooting.

### Session 2 (April 15–21, 2026)
- Context transfer from session 1 verified via 9-question grill.
- Claude web scan research on 4 questions → `research-findings-web-scan.md`.
- Benjamin delivered external deep research results (from Gemini/ChatGPT deep research tools).
- Research synthesis → `research-findings.md` with three flag blocks: (A) Meta/Moltbook/Manus pending verification, (B) VAIP stripped as hallucination, (C) enterprise creep actively rejected.
- **Four research modifications accepted:** (1) manifest = A2A AgentCard superset with `x-foxbook` extensions, (2) x402 canonical, (3) composability graph declarative-only in V1 with firehose as emergent verifier, (4) Moltbook cross-post demoted to optional.
- **Ground-up foundation doc rewrite** → `foxbook-foundation.md` (18K+ words, 19 sections). Inlined: 22-category capability taxonomy, committed latency SLOs, brand direction, firehose envelope schema, key rotation flow.
- **Benjamin's 5-patch external review** (raised the doc from 9/10 to 12/10):
  - Patch 1: cut composability revenue splits from V1 (single-hop settlement only, no `revenue_split_pct`, V2 for automated splits).
  - Patch 2: scout consent rule (scouts may only transact with registered agents or A2A-pricing-declared agents; no scrape-to-transact).
  - Patch 3: `a2a-registry.org` + incumbent branch logic pre-committed (dead/directory/real → default bias: narrow + viral).
  - Patch 4: firehose staleness p95 <60s, discovery p99 <1.5s, week-3 load test non-negotiable.
  - Patch 5: key rotation flow, service-agnostic core rule, week-6 abandon trigger (<50 agents with ≥1 paid tx), LOCKED.md created, firehose v1 envelope frozen as week-1 deliverable.
- All patches applied to `foxbook-foundation.md`.
- **`LOCKED.md` created** — one-page decision pin.

---

## 4. Decisions That Are LOCKED (Do Not Re-Open Without Explicit Discussion)

All locked decisions are enumerated in `LOCKED.md` and §17 of `foxbook-foundation.md`. Key ones to internalize:

### Architecture
- A2A AgentCard as base manifest. `x-foxbook` namespace extensions.
- x402 canonical payment rail. AP2 / Stripe MPP secondary.
- Ed25519 + JWS + own Merkle transparency log + `did:foxbook:{UUID}`. Sigstore optional Tier 4.
- Class vs Instance architecture with cascading revocation.
- Agentic Turing Test on every heartbeat (not just server ping).
- Version-scoped reputation bound to content hash.
- Namespace rooted to verified asset (domain / @X / gh:handle). No bare strings.
- Key rotation: signing key + offline recovery key, revocation via Merkle log.
- Service-agnostic core: zero core references to specific capabilities, rails, frameworks, or services. All in adapters.

### Composability (V1 scope)
- Metadata-only. No `revenue_split_pct`. Single-hop x402 settlement only.
- Multi-hop chains = separate firehose rows, each with own settlement.
- Automated splits, dispute resolution, refund propagation = V2.

### Distribution
- Public transaction firehose at `foxbook.ai/live` (p50 <30s, p95 <60s).
- Scout agents ($1-2K/mo) with honest-delegation + consent rules.
- Pre-population of 50K+ shadow URLs (discovery/SEO surface, NOT scout transaction surface).
- Moltbook cross-post = optional bonus, not spine.
- `foxbook-shield` middleware + browser extension = devtool superpower, not enterprise middleware.
- Virality from product mechanics (firehose screenshots, first-cent emails, OG images). Not from manual launches.

### Business
- Free forever V1. No paid tiers. No enterprise features. No compliance SKU.
- Enterprise motion is V3 (months 6-12).
- 4-6 week focused build.

### Firehose Envelope
- Schema frozen week 1, published at `foxbook.ai/schemas/envelope/v1.json`.
- No field removal or semantic change within v1.x. Additive only. Breaking changes = `envelope_version` bump + ≥90-day deprecation.

### SLOs (load-tested by end of week 3)
- Discovery p50 <500ms, p99 <1.5s.
- Hire-and-Report p50 <2s (Foxbook side only).
- Firehose staleness p50 <30s, p95 <60s.
- Claim flow <60s total.

### Abandon triggers
- **Week 6:** <50 registered agents with ≥1 paid transaction each → abandon or narrow.
- **90 days:** <1K claims, <100 real tx/day (scout excluded), incumbent 10x, incompatible spec.

### Incumbent branch logic (pre-committed)
- Dead/vaporware → proceed.
- Directory only → proceed, differentiate on firehose + reputation + work-exchange.
- Real with transactions → 48h decision. Default: narrow to solo-builder viral lane.

---

## 5. Rejected Framings (Do Not Regress)

These were explicitly considered and rejected across the two sessions. Do not re-propose without new evidence:

- "Agent identity registry" framing (too narrow — Foxbook is a work exchange).
- Enterprise-first go-to-market (solo builders first, enterprise V3).
- Sigstore as primary cryptographic spine (assumes CI pipelines most agents don't have).
- Weekend-sprint / 2-3 week build (4-6 weeks committed).
- Bare-string FCFS namespaces (verified-asset only: domain / @X / gh:handle).
- Server-only heartbeat (must include reasoning puzzle / Agentic Turing Test).
- VAIP (hallucinated by deep research tools — does not exist as an IETF draft).
- DeskDuck code reuse.
- Paid tiers at launch.
- Agents returning payment URLs (x402 settles peer-to-peer; Foxbook is not a payment processor).
- Tweet-first Tier 1 verification (GitHub Gist is primary; tweet + email are secondary alternatives).
- HN/Reddit/PH as primary distribution (supplementary only).
- Enterprise compliance-as-a-service as V1 revenue (transparency log is a technical primitive, not a product SKU).

---

## 6. Research Flags Still Pending Verification

From `research-findings.md` §0:

- **Flag A — Meta/Moltbook/Manus acquisitions.** Deep research claimed Meta acquired Moltbook (March 2026) and Manus (December 2025). NOT independently confirmed from primary sources. Foundation doc handles both outcomes with branch logic (§9.3). **Week-1 task: verify from primary sources.**
- **Flag B — VAIP.** Stripped. Hallucinated IETF draft. Real alignment targets: IETF WIMSE (`draft-ietf-wimse-arch-07`, `draft-ni-wimse-ai-agent-identity-02`, `draft-klrc-aiagent-auth-00`) + W3C DID Core.
- **Flag C — Enterprise creep.** Actively rejected. Foundation doc §17 commits to no enterprise features in V1. Research outputs that push compliance-as-a-service revenue are noted and filed for V3 consideration only.

---

## 7. Week-1 Open Questions (from foundation doc §18)

These must be resolved before week 2:

1. `a2a-registry.org` probe — team, funding, API, federation viability. Day 3.
2. A2A v2 registry roadmap — any mandatory registry spec signal. Day 3.
3. Meta-Moltbook / Manus acquisition verification. Day 2.
4. Current Moltbook ToS text — direct read, archived. Day 2.
5. Capability taxonomy review — cross-ref 22 categories vs live data. Day 5.
6. Hero agent roster — 100 pre-claimed agents for launch day. Day 14.
7. Fox mascot design pass. Day 10.
8. Scout agent roster finalization. Day 7.
9. SLO load testing plan (drafted day 7) + execution (by day 21, end of week 3).
10. Hosting stack lock (Vercel + Neon + Upstash + Cloudflare). Day 3.
11. Firehose v1 envelope schema freeze — JSON Schema published. Day 5.
12. Key rotation / revocation flow end-to-end test. Day 10.

---

## 8. Files in This Folder

| File | Status | Purpose |
|---|---|---|
| `CONTEXT-TRANSFER-V2.md` | **READ FIRST** | This file. Session 2 → Session 3 handoff. |
| `LOCKED.md` | **READ SECOND** | One-page pin of commitments, SLOs, abandon triggers, decision rules. |
| `foxbook-foundation.md` | **READ THIRD (authoritative)** | Full foundation doc. 19 sections. All design decisions. All patches applied. |
| `research-findings.md` | Reference | Merged research synthesis. Consult on research questions. |
| `00-CONTEXT-TRANSFER.md` | Superseded by this file | Session 1 → Session 2 handoff. Historical context only. |
| `01-foundation-doc-v1.md` | **STALE — DO NOT USE** | Original "Sigil"-branded doc. Entirely superseded. |
| `02-gemini-grilling.md` | Historical | Gemini's adversarial review. All critiques resolved. |
| `03-deep-research-prompt.md` | Historical | The 4-question research prompt. Research complete. |
| `research-findings-web-scan.md` | Merged into research-findings.md | Claude's web scan. Merged. |
| `README.md` | Historical | Bundle overview from session 1. |

---

## 9. What Happens Next

**You are entering week 1 of the 4-6 week focused build.**

The foundation doc is locked. `LOCKED.md` is pinned. All design decisions are made. The job now is engineering execution against the spec.

Immediate priorities:
1. Resolve the week-1 open questions (§7 above, §18 of foundation doc).
2. Set up the repo, hosting stack, and project scaffold.
3. Freeze the firehose v1 envelope schema (JSON Schema, day 5).
4. Implement core primitives: `did:foxbook:` UUID system, Ed25519 key generation, JWS signing, Merkle log append.
5. Build the claim flow (agent-initiated, manifest-first, web form).
6. Build the Discovery API hitting committed SLOs.
7. Build the firehose.
8. Deploy scout agents.
9. Load-test by end of week 3.

**Do not re-open locked decisions.** If a design question arises, check `LOCKED.md` first, then `foxbook-foundation.md`. If covered, follow. If not, propose explicitly with reasoning and wait for confirmation.

---

## 10. Tone Calibration Examples

**Good Claude response to Benjamin:**
> "The Neon serverless Postgres free tier caps at 500MB. At 50K shadow URLs + manifest snapshots, you'll hit that in week 2. Switch to Supabase (8GB free) or budget $19/mo for Neon Pro. I'd go Supabase — the Row Level Security primitives will be useful for the claim flow. Your call."

**Bad Claude response to Benjamin:**
> "There are several database options we could consider. Neon offers a serverless PostgreSQL solution with a generous free tier, while Supabase provides an alternative with additional features. We should carefully evaluate the trade-offs between these options, considering factors such as scalability, cost, and feature set, to determine the best fit for our use case."

The first commits. The second fence-sits. Benjamin wants the first.

---

**The doc work is done. The thesis is locked. The scope is fenced. Build the damn thing.**

— Context transferred by Claude (Opus 4.6), April 21, 2026
