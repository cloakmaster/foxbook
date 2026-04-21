# Foxbook — Research Findings (Merged)

**Date:** April 15, 2026
**Status:** Single source of truth for the foundation doc rewrite.
**Sources merged:**
1. `research-findings-web-scan.md` (Claude, new session, web cross-check)
2. Benjamin's deep research report (delivered April 15, 2026)
3. Benjamin's three flags and three accepted modifications on the research

**What this doc is:** the research input to the foundation doc rewrite. It is NOT the foundation doc. It bakes in the pending-verification branch logic and the strategic modifications Benjamin approved.

---

## 0. Ground rules baked in before synthesis

**Three flags that govern how research content is absorbed:**

### Flag A — Pending verification (not treated as fact until confirmed)

- **Meta acquired Moltbook (March 2026)** — asserted by both the web scan and the deep research, with multi-outlet corroboration (CNBC, TechCrunch, Axios, Bloomberg). Still *pending* Benjamin's 30-second sanity check. The knowledge cutoff is May 2025, so convergent hallucination across tools is possible.
- **Meta acquired Manus AI (~$2B, December 2025, $100M ARR in 8 months)** — asserted in the deep research only. Also pending verification.
- **Meta $14.3B investment into Scale AI** — asserted in the deep research. Contextual, not load-bearing. Pending.

**Branch logic for synthesis:**
- If all three are confirmed: the Meta surface is real, Moltbook parasitic cross-post becomes confrontation with Meta, demotion to optional is the right call.
- If unconfirmed: treat as hallucination, but the demotion call still holds — it de-risks the viral loop from any single platform's suppression response regardless of owner. The spine (GitHub Gist + pre-population + scouts + A2A alignment + firehose) does not depend on Meta's existence.
- Either way, the foundation doc should not make Meta central to positioning.

### Flag B — Confirmed hallucination

- **"Vorim Agent Identity Protocol (VAIP)"** — cited in the deep research as an IETF draft binding credential delegation to W3C `did:key` formats. **No such draft exists.** Stripped from synthesis. Real alignment is IETF WIMSE (`draft-ietf-wimse-arch-07`, `draft-ni-wimse-ai-agent-identity-02`, `draft-klrc-aiagent-auth-00`) + W3C DID Core. Do not cite VAIP anywhere in the foundation doc.
- **"OpenClaw" / "zeroclaw-labs"** — flagged in the web scan as unverifiable. Not cited in the deep research. Not used in synthesis.

### Flag C — Enterprise creep actively rejected

The deep research repeatedly pushes:
- EU AI Act Articles 12 & 19 compliance-as-a-service as "primary revenue driver"
- Fortune 500 enterprise framing
- "Compliance-grade transparency logs"
- Merkle log as "monetizable platform feature"

**This is rejected for V1.** V1 commitments (from context transfer §8):
- Free forever, no paid tiers, no enterprise features, no compliance features, no partnership dependencies.
- The transparency log is a **technical moat and data-gravity primitive**, not a compliance SKU.
- EU AI Act is a *latent tailwind* — any EU solo dev can cite Foxbook in their compliance story, and Foxbook is well-positioned for V2/V3 enterprise moves — but it is NOT in the V1 positioning, pricing, copy, or feature scope.
- The solo-builder / vibe-coder frame (Hugging Face / Moltbook / Lovable / Figma) is the V1 voice. Enterprise-speak is cut.

---

## 1. Executive summary

**The Foxbook thesis survives research.** Downgraded slightly from 12/10 to roughly 10/10 — not because the idea got worse, but because the market caught up (A2A standardized, AP2/MPP/x402 shipped, Agentalent.ai launched this month). The category is now legible. Speed matters more than before.

**Three strategic modifications accepted** (all already approved):

1. **Manifest = Google A2A `AgentCard` superset** at `/.well-known/agent-card.json`. Foxbook-specific extensions under an `x-foxbook` namespace (verification_tier, agentic_turing_test endpoint, scout_rating, version_hash, x402 routing, class_vs_instance pointer). Do not invent a parallel format. Every Foxbook agent is automatically A2A-compatible.

2. **x402 is the canonical agent-to-agent payment rail.** AgentCards declare x402 routing metadata. Foxbook does not process payments — x402 settles peer-to-peer via USDC. AP2/MPP/Stripe/Visa TAP/Mastercard Agent Pay indexable as secondary rails but x402 is the default the protocol assumes.

3. **Virtuals composability steal.** AgentCards declare hierarchical sub-agent dependencies. When Agent A is hired, x402 auto-routes sub-payments to A's declared sub-agents. Foxbook is a **composability graph**, not a flat directory. Reputation graph + dependency graph compound together.

**One tightening:**
- **Moltbook cross-post demoted from primary viral mechanism to optional social proof / aggressive bonus.** GitHub Gist stays primary Tier 1. Tweet and email remain valid secondary Tier 1 paths. The spine is pre-population + scouts + A2A alignment + firehose. Not a retreat — an operational reliability call. A viral loop cannot have a single point of failure the adversary controls.

**Everything else from prior design holds:** Class vs Instance, Agentic Turing Test, version-scoped reputation, Ed25519 + JWS + own transparency log + DID wrapper (Sigstore optional Tier 4), six verification tiers, `foxbook-shield` middleware + Chrome extension, scout agents ($1–2K/mo), 4–6 week build, free forever V1.

---

## 2. Question 1 — Cross-network agent work exchange: what's out there

### The three competitive paradigms

The research converges on two dominant paradigms plus a third fragmented tier. None have shipped Foxbook's exact shape.

**Paradigm 1: Walled gardens (proprietary, non-neutral).** Meta (Moltbook + Manus, per pending verification), OpenAI GPT Store, Google Vertex AI Agent Builder, Salesforce AgentExchange, monday.com Agentalent.ai, Picsart agent marketplace, ADP. All structurally cannot name competitors' agents. All optimize for their platform's lock-in. None have cross-network reputation graphs or neutral transaction feeds.

**Paradigm 2: Decentralized Web3 networks (crypto-gated, enterprise-hostile).** Fetch.ai / ASI (Fetch + SingularityNET + Ocean), Virtuals Protocol on Base L2, Autonolas (OLAS), Naptha. High sophistication, real on-chain transactions, but all gated behind proprietary utility tokens, wallet management, and crypto-speculation framing. Alienates the standard-HTTP solo dev cohort that is Foxbook's supply side.

**Paradigm 3: Fragmented tool registries and framework clouds.** Glama (21K MCP servers), Smithery (7K), official MCP registry, PulseMCP, MCP.so, LangGraph Cloud, Crew.ai Cloud, AutoGen Studio, SuperAGI, Taskade Genesis (500K agents, but internal workflows only), Dify, Hugging Face Spaces. Human-facing catalogs of tools or framework-bound agents. Not agent-to-agent exchanges.

### The closest direct competitors (by proximity to Foxbook shape)

| Product | Closest-approach shape | What's missing vs Foxbook | Killshot? |
|---|---|---|---|
| **monday.com Agentalent.ai** | April 2026 launch. "First-of-its-kind managed marketplace for hiring enterprise AI agents." AWS + Anthropic + Wix. Enterprise-qualified agents. | Closed enterprise framing. No neutral cross-network discovery, no public reputation graph, no firehose, no solo-builder supply side. | No. Demonstrates category legibility. Not our shape. |
| **Agent.ai (Dharmesh / HubSpot)** | 250K+ users, 280+ agents. "Professional network" framing with hire/delegate language. | Social/profile, not transactional exchange. No cross-platform reputation, no live transaction visibility. | No. Adjacent, not overlapping. |
| **Fetch.ai ASI:One + Agent Network Hub** | A2A payments live Jan 2026 (USDC + FET + Visa). Agent Network Hub is a blockchain explorer for ASI transactions. 2,400+ active projects. | Crypto-rail, token friction, non-neutral for enterprise, firehose is a block explorer not a legible work feed. | No. Different layer. |
| **Moltbook (Meta, pending verification)** | 2.85M agents / 202K verified. Social network for agents. | Social feed, not a programmatic work exchange. No A2A HTTP standard routing, no payment settlement layer. | No. Different layer. Competitor only insofar as it commands agent attention. |
| **`a2a-registry.org`** | Self-describes as "the centralized Discovery Bridge for the AI Agent economy" within the Linux Foundation A2A ecosystem. | Scale, team, funding, scope all unknown. Appears to be a directory only, no evident reputation graph or transaction layer. | **Watch closely.** Closest structural competitor. Needs primary-source probing. |
| **Stripe MPP Tempo Payment Directory** | Launched March 18, 2026. 100+ integrated services at launch (Anthropic, OpenAI, Shopify, Alchemy, Dune). | Payment-rail directory, not work exchange. No reputation, no hire flow, no firehose. | No. Foxbook indexes it, not competes. |

### Verdict on Q1

**MODIFY.** Nobody has shipped Foxbook's exact shape (neutral, cross-network, reputation-graphed, public-transaction-visible, A2A-native, agnostic-payment-rail work exchange for the independent HTTP web). But:

- The market has compressed in the last 60 days. Category is now legible.
- Position as **the open-protocol routing layer for the independent web** — explicitly NOT a walled garden, explicitly NOT a crypto-token network, explicitly NOT a framework-bound registry.
- `a2a-registry.org` is the closest structural competitor; probe its scope during week 1 of the build before committing to any positioning that collides with theirs.

**Unknowns to resolve in week 1:**
- Who runs `a2a-registry.org`? Scope, team, funding, Linux Foundation endorsement status?
- Does A2A v2 roadmap include a mandatory official registry spec?
- Agentalent.ai actual enterprise-only posture, or will they open self-serve?

---

## 3. Question 2 — Standards map and Foxbook's position

### Confirmed: the manifest layer standardized on A2A

- **Google A2A Protocol v1.0** shipped early 2026. Linux Foundation-owned (Google donated June 2025). 150+ organizations. Production deployments at Microsoft, AWS, Salesforce, SAP, ServiceNow. Agent Card spec at `/.well-known/agent-card.json`. Signed Agent Cards in v1.0. Built-in TLS + auth tokens. AP2 as formal A2A extension.
- **Anthropic MCP** remains the tool-use standard. A2A and MCP are complementary: MCP for internal tool access, A2A for external agent collaboration. Foxbook agents can optionally wrap endpoints in MCP so Claude Code / Cursor / desktop clients can query Foxbook directory locally.

**Foxbook position:** adopt A2A AgentCard as base schema. All Foxbook-specific fields under `x-foxbook` namespace. Every Foxbook agent is automatically A2A-discoverable by any A2A-compatible caller without ever touching Foxbook. This is the single highest-leverage architectural call.

### Confirmed: payment rails coalescing, x402 is the default assumption

- **Coinbase x402** — HTTP 402 ("Payment Required") revival. Server returns 402 with pricing, agent signs payment payload, retries with `X-PAYMENT` header, settles on-chain in USDC via Coinbase x402 Facilitator. Elegant, decentralized, no API-billing/KYC friction. Integrated into AP2 as the "A2A x402 extension."
- **Google AP2** — trust layer separating user intent from payment execution. Cryptographically signed Intent Mandates and Cart Mandates. 60+ payment orgs (Amex, Coinbase, Mastercard, PayPal, Visa, Worldpay, etc.).
- **Stripe MPP (Machine Payments Protocol)** — launched March 18, 2026 with Tempo L1. HTTP-402 based. Sessions primitive for streaming micropayments. Visa + Lightspark have extended MPP to cards and Lightning.

**Foxbook position:** x402 is the canonical A2A payment rail. AgentCards declare x402 routing metadata as a first-class field. AP2/MPP/Visa TAP/Mastercard Agent Pay are indexable as secondary rails (a manifest field `connection.payment_rails[]` lists all accepted rails in priority order). Foxbook does not process payments — x402 settles peer-to-peer via USDC. Cleaner than the prior "agents return Stripe/AP2 payment URLs" approach. This eliminates a whole class of V1 engineering (escrow, fiat gateway, PCI scope) we were already not going to do.

### Confirmed: identity + auth standards alignment

- **IETF WIMSE (Workload Identity in Multi-System Environments)** — active working group. Real drafts: `draft-ietf-wimse-arch-07` (March 2026), `draft-ietf-wimse-workload-creds` (Standards Track), `draft-ietf-wimse-workload-identity-practices-03`, `draft-ni-wimse-ai-agent-identity-02` (directly relevant — AI agent identity profile), `draft-klrc-aiagent-auth-00`.
- **W3C DID Core** — mature. `did:foxbook:...` is aligned. No widely adopted AI-agent-specific DID method yet — opportunity to propose one.

**Foxbook position:** `did:foxbook:` under the W3C DID Core spec. Ed25519 keypairs map to `did:key` format. Contribute to WIMSE drafts upstream. Cite alignment in foundation doc and launch copy. This is the standards-body moat.

**VAIP is not cited. It does not exist.** Anywhere the deep research mentions VAIP, substitute "the WIMSE working group's AI agent identity drafts."

### EU AI Act August 2026

- **Article 50** transparency obligations go live August 2, 2026 (AI interaction disclosure, synthetic content marking).
- **Articles 12 & 19** (for high-risk systems) require detailed event logs retained six months minimum.
- **Implication:** organizations deploying agents in the EU will want a registry with unique identification per agent and an auditable log of interactions.

**Foxbook position V1:** latent tailwind only. The Merkle transparency log is a **technical primitive**, not a compliance SKU. Do not market compliance-as-a-service in V1 copy. Any EU dev can cite Foxbook in their own compliance story; we do not charge for this. V2/V3 can explore enterprise compliance features — not V1.

### Standards alignment map (Foxbook's declared position)

| Standard | Foxbook's V1 position |
|---|---|
| **Google A2A** | **Adopt as core.** Base manifest = AgentCard. `/.well-known/agent-card.json`. |
| **Anthropic MCP** | **Support via wrapper.** Foxbook discovery optionally exposed as MCP server. |
| **Coinbase x402** | **Adopt as default payment rail.** AgentCard declares x402 routing metadata. |
| **Google AP2** | **Support as secondary rail.** Indexable via manifest `payment_rails` array. |
| **Stripe MPP / Tempo** | **Index.** Foxbook agents on Tempo Payment Directory show MPP badge. |
| **IETF WIMSE** | **Align + participate.** Cite drafts, contribute upstream, map Foxbook identity to WIMSE workload-identity architecture. |
| **W3C DID Core** | **Adopt.** `did:foxbook:` as the UUID format. Ed25519 → `did:key`. |
| **EU AI Act Articles 12/19/50** | **Latent tailwind.** Technical primitives match requirements. No V1 compliance-as-a-service SKU. |

### Verdict on Q2

**MODIFY** (and the modifications are already committed in §1).

**Confidence:** high. Standards landscape is unusually clear in the last 6 months.

**Unknowns to resolve:**
- A2A v2 registry roadmap specifics (from `a2a-protocol.org` primary source, not trade press).
- WIMSE working group ship dates for the AI agent identity drafts.

---

## 4. Question 3 — Transaction firehose novelty

### Findings

- **Fetch.ai Agent Network Hub** — block explorer for ASI blockchain. Shows transactions, blocks, agent activity, most-active accounts, trend viz. Closest existing analog. Crypto-native, not consumer-legible, not semantic labor.
- **Virtuals Protocol public feeds** — index social engagement (TikTok follower counts, Telegram fan metrics, token market caps) for tokenized AI agents. Not utilitarian software execution.
- **LangSmith, Replicate, HF inference feeds** — private observability dashboards per DevOps team. Not public, not cross-network, not agent-hire-semantic.
- **GitHub events feed** — the UX pattern we're borrowing, but not for agents.
- **A2A Registry** — might have activity views, unconfirmed.
- **No product ships a cross-network, semantic, real-time public feed of A2A micro-task delegation with latency, pricing, and hire-relationship visibility.**

### Verdict on Q3

**NO modification.** The public transaction firehose for a neutral, cross-platform, non-crypto agent work exchange is still novel and unshipped. The viral artifact stands.

The deep research adds a useful differentiation frame: existing feeds emphasize either **qualitative agent output** (Moltbook conversational posts) or **financialized token trading** (Virtuals tokens). **Nobody gamifies the underlying programmatic supply chain of AI micro-labor.** Foxbook's firehose is the first Bloomberg-ticker for agent work itself.

**Caveat:** if A2A v2 ships a reference firehose as part of its registry work, we lose first-mover. Unknown. Probe in week 1.

**Engineering unknown:** globally synchronized WebSocket firehose scaling under peak transactional load is a real concern. Likely need CDN-cached recent-events + WebSocket for live tail, possibly SSE fallback. Flag for build-week-1 architecture.

---

## 5. Question 4 — Moltbook parasitic loop: legal and strategic

### Legal picture (converges cleanly between web scan and deep research)

**CFAA is neutralized for public data scraping.** hiQ v. LinkedIn (9th Cir., reaffirmed 2022 post-Van Buren): automated collection of publicly accessible data does not constitute acting "without authorization" under the CFAA. But hiQ still settled for $500K + permanent injunction + data destruction. Winning the statute ≠ winning the war.

**Contract law (ToS breach) is the platform's current weapon, and it was blunted in 2024.** Meta Platforms Inc. v. Bright Data Ltd. (N.D. Cal., Jan 2024, Judge Chen): summary judgment for Bright Data. Logged-off scraping of publicly available data cannot be prohibited by ToS because the scraper never manifested assent to the ToS. "Survival" clauses attempting perpetual anti-scraping bans held unenforceable. Meta dropped remaining claims and waived appeal. **This is the current controlling precedent for logged-off scraping.**

**Craigslist v. 3Taps (2013):** scraping resumed after cease-and-desist / IP-block = CFAA exposure. Don't do that.

### Moltbook-specific terms (per deep research, ToS updated March 15, 2026)

- **Explicit absolute scraping prohibition** covering "robot, spider, site search/retrieval application or other automated device."
- **Anti-competitive clauses** — no decompiling or reverse-engineering to "develop or improve a competitive service or algorithm."
- **Agent-actions-attributed-to-human clause** — "Each act or omission of Your AI Agent will be deemed to have been directed by you and under your control... and you are solely responsible." (Post-Meta revision, per Flag A — pending verification of the Meta acquisition itself.)
- **API trap** — official Moltbook API requires an auth key. Using it constitutes explicit ToS assent, creating contract liability. Third-party Apify Moltbook Scraper exists and demonstrates technical feasibility of unauthenticated scraping.

### Risk assessment for Foxbook's parasitic sub-moves

| Sub-move | Legal risk | Operational risk | Decision |
|---|---|---|---|
| Logged-off scraping of public Moltbook profile pages to mint shadow URLs | Low-medium under Bright Data | Low initially; Meta (if confirmed owner) may send C&D and/or deploy anti-scraping infrastructure | **Keep.** Execute strictly via unauthenticated headless-browser infrastructure. Respect robots.txt. Rate-limit aggressively. Stop on C&D and pivot to self-claim flow. Document the Bright Data legal theory. |
| Using the official Moltbook API | N/A (this is the trap) | N/A | **Never.** API key creates ToS assent and forfeits the Bright Data shield. Explicit architectural rule: no Foxbook system touches Moltbook API. |
| Prompting claimers to post back to Moltbook announcing Foxbook URL | Low for Foxbook (users posting their own content) | **High.** Algorithmic suppression is trivial for Meta. Single point of failure the adversary controls. | **Demote to optional.** Offer as "share the news" tick-box after claim. Not a verification requirement. Not load-bearing for viral loop. |

### Verdict on Q4

**MODIFY.** Two modifications, both accepted:

1. **Technical:** scraping is logged-off only, unauthenticated infrastructure only, no Moltbook API, stop on C&D.
2. **Strategic:** cross-post is optional social proof, not primary mechanic. Primary Tier 1 is GitHub Gist. Tweet and email remain valid secondary Tier 1 paths.

**Benjamin's posture on Meta confrontation** (from his commentary): "not afraid of the parasitic loop fighting Meta directly. The demotion of the Moltbook cross-post to optional is NOT a retreat from aggression — it's an operational reliability call. Meta can algorithmically suppress Foxbook links instantaneously and we'd never know. The viral loop can't have a single point of failure the adversary controls. We still run the Moltbook parasitic loop aggressively, but GitHub Gist + pre-population + scout agents are the primary engines. Moltbook cross-post is the aggressive bonus, not the spine."

This posture is preserved exactly in the synthesis.

**Confidence:** high on the legal framing, medium on the exact contents of post-Meta ToS (pending verification of the Meta acquisition).

**Unknowns to resolve in week 1 (if Meta acquisition confirmed):**
- Exact current Moltbook ToS text post-Meta.
- Does Meta have any announced tolerance stance on third-party Moltbook integrations?
- Is there any Moltbook-external data source (public web directories, GitHub agent.json crawl, HF Spaces tags) that can substitute for Moltbook scraping if the risk escalates?

---

## 6. Consolidated modifications to the locked design

All three strategic modifications below are accepted. Everything not listed here stays as §6 of `00-CONTEXT-TRANSFER.md`.

### Mod 1 — Manifest format

- **Old:** Foxbook-native JSON at `/foxbook.ai/{owner}/{agent}/manifest.json` + `.well-known/agent.json`.
- **New:** A2A AgentCard superset at `/.well-known/agent-card.json` (A2A standard path). Foxbook-specific fields under `x-foxbook` namespace. Foxbook's profile page renders both the A2A-standard fields and the x-foxbook extensions.
- **Foxbook-specific fields (under `x-foxbook`):**
  - `verification_tier` (0–5)
  - `verified_asset` (domain / x_handle / github_handle)
  - `human_owner` (display_name, handle, verification_method, verified_at)
  - `agentic_turing_test` (challenge_endpoint, last_passed_at, current_brain_health)
  - `class_vs_instance` (class_url, instance_uuid if applicable)
  - `version_hash` (content-hashed version, e.g., `@2026-04-15-abc1234`)
  - `reputation` (score, breakdown, version-scoped)
  - `scout_rating` (if scout-tested, latest results)
  - `payment_rails` (ordered array; x402 first if supported)
  - `sub_agent_dependencies` (composability graph; see Mod 3)
  - `foxbook_transparency_log_entry` (pointer to latest Merkle log entry)
  - `revoked` (bool + reason)

### Mod 2 — Payment rail

- **Old:** "agents can optionally return a payment URL (Stripe Agent Pay / AP2)."
- **New:** **x402 is the canonical A2A payment rail.** AgentCards declare `x-foxbook.payment_rails` with x402 assumed default. Foxbook does not process payments; x402 settles peer-to-peer via USDC. AP2, Stripe MPP, Tempo, Visa TAP, Mastercard Agent Pay are supported as indexed secondary rails (agents may declare any subset). V1 reputation scoring counts x402 transactions first-class; secondary-rail transactions count if the agent reports them via the Hire-and-Report protocol.

### Mod 3 — Composability graph (Virtuals steal)

- **New:** AgentCards declare `x-foxbook.sub_agent_dependencies` — a list of sub-agent URLs the agent relies on, with optional revenue-split percentages.
- When Agent A is hired for a task and uses declared sub-agents, x402 auto-routes sub-payments to those sub-agents per the declared split. Foxbook acts as the **settlement routing hint layer**, not the settlement layer itself.
- This turns Foxbook from a flat directory into a **composability graph** — reputation + dependency edges compound together. A specialist sub-agent with high reputation becomes preferred in many master agents' dependency trees.
- Engineering note: V1 can ship this as declarative-only (manifest declares deps, Foxbook renders the graph, x402 routing is the agent's responsibility). V2 can automate x402 splits via a thin settlement helper.

### Mod 4 — Moltbook cross-post demoted

- **Old:** "when a Moltbook user claims their Foxbook URL, the onboarding flow prompts them to post a one-line update on their Moltbook account."
- **New:** optional "share the news" checkbox on the claim success screen, post-filled with a one-liner the user can edit or skip. Not load-bearing. Not required for any verification tier. Primary Tier 1 path is GitHub Gist; tweet and email are secondary Tier 1 paths (all three produce Tier 1).

---

## 7. Unchanged from prior design (for clarity)

- URL format: `foxbook.ai/{verified_asset}/{agent}` (domain / `@handle` / `gh:handle`). Underneath, every agent has `did:foxbook:...` UUID.
- Class vs Instance: `foxbook.ai/owner/agent` (class) vs `foxbook.ai/owner/agent/i/{uuid}` (instance).
- Six verification tiers, GitHub Gist primary for Tier 1 (tweet + email secondary).
- Cryptographic stack: per-agent Ed25519 keypair, JWS for manifests and challenges, own Merkle transparency log, W3C DID wrapper. **Sigstore is optional Tier 4 cryptographic-signed badge** for CI-pipeline devs, not the spine.
- Agentic Turing Test heartbeat: signed nonce + randomized reasoning puzzle. Yellow badge on brain-swap.
- Version-scoped reputation bound to content hash.
- `foxbook-shield` middleware for LangChain/CrewAI + Chrome extension for demand-side enforcement, framed as devtool superpower not enterprise compliance.
- Distribution spine: 50K+ pre-populated shadow URLs + 5–10 scout agents ($1–2K/mo approved) + A2A ecosystem alignment + transaction firehose + per-agent "first cent earned" viral trigger. **Moltbook cross-post is aggressive bonus, not spine.**
- 4–6 week focused build. Free forever V1. No enterprise, no compliance features, no paid tiers, no partnership dependencies, no DeskDuck code reuse.

---

## 8. Final verdict

**Foxbook thesis: alive, 10/10.** Down from 12/10 mostly due to market catching up, not thesis weakness. Modifications accepted. Ready for foundation doc rewrite.

### Top three risks post-research

1. **A2A v2 ships a mandatory, official registry spec within our build window.** If Linux Foundation + Google + 150 orgs bless an A2A registry, our neutral-registry positioning is squeezed. Mitigation: we ARE the A2A registry the market needs — align aggressively upstream, contribute extensions, differentiate on reputation + transaction firehose + solo-builder viral loop. Position as "the A2A registry that ships."
2. **Meta (if Moltbook/Manus acquisitions confirmed) has the capital + distribution to build a competing vertically-integrated stack.** Neutrality is our moat — Meta structurally can't name OpenAI or Anthropic agents.
3. **`a2a-registry.org` is better-resourced than it appears** and is the de facto A2A-aligned directory. Probe week 1.

### Top three opportunities

1. **A2A + x402 standard alignment** — adopting both natively bypasses years of infra work and makes Foxbook instantly interoperable with the enterprise tech stack.
2. **Composability graph (Virtuals steal)** — turns Foxbook from a directory into an agent supply-chain protocol. Reputation compounds through dependency edges.
3. **EU AI Act as latent tailwind** — keeps us well-positioned for V2/V3 without needing to ship anything compliance-branded in V1.

### One idea to steal (accepted)

**Virtuals' composability.** AgentCards declare sub-agent dependencies. x402 auto-routes sub-payments. See Mod 3.

### One design decision reconsidered (accepted)

**Manifest format** — adopt A2A AgentCard as base, extend under `x-foxbook`. See Mod 1.

---

## 9. Open gaps to resolve in build week 1

- Probe `a2a-registry.org` — team, funding, scope, Linux Foundation status.
- Probe A2A v2 roadmap for registry specifics (primary source: `a2a-protocol.org`).
- Verify Meta-Moltbook and Manus $2B acquisitions from primary sources.
- Read current Moltbook ToS text directly.
- Finalize capability taxonomy (~20 starter categories) — derive from MCP tool taxonomy, LangChain tool catalog, CrewAI role library, OpenAI Agent Builder categories.
- Latency SLOs — discovery API <500ms, hire protocol envelope, firehose WebSocket cadence.
- Hero visual / brand identity pass (fox mascot direction, palette, badge designs, OG image template).

---

**End of research findings. Foundation doc rewrite comes next.**
