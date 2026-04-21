# Foxbook — Web Cross-Check Research Findings

**Author:** Claude (new session), web scan only
**Date:** April 15, 2026
**Scope:** Quick web cross-check of the four questions in `03-deep-research-prompt.md`. This is NOT the deep research — Benjamin's deep research tool output will land separately. This doc is meant to be diffed against it and merged into a single `research-findings.md`.
**Confidence self-rating:** medium. Web search surface-read only, ~45 min of searching, no primary-source verification on every claim.
**Known hallucination risk:** prior research rounds hallucinated ClawHub/ClawHavoc/skills.sh/AIGP-Σ. I saw "OpenClaw" and "zeroclaw-labs" references in this scan that I could NOT verify from primary sources. Flagged inline.

---

## Executive summary

Foxbook is **NOT dead, but the thesis needs three material modifications** and one strategic reconsider. Bottom line up front:

1. **MUST align with Google A2A Agent Card spec** (not invent a parallel manifest format). A2A v1.0 shipped early 2026, donated to Linux Foundation, 150+ orgs, production deployments at Microsoft/AWS/Salesforce/SAP/ServiceNow, includes Signed Agent Cards and AP2 as a formal extension. Inventing our own manifest format is now a losing battle. Foxbook's manifest should be an **A2A Agent Card superset** — we add the fields A2A doesn't have (cross-platform reputation, version-hashed reputation, Agentic Turing Test results, human-owner binding, Tier system), but the base document lives at `/.well-known/agent-card.json` in A2A format. This preserves our differentiation while making every Foxbook agent automatically A2A-compatible.

2. **Direct competitor surfaced: `a2a-registry.org`**. Positions itself as "the centralized Discovery Bridge for the AI Agent economy" within the Linux Foundation A2A ecosystem. Unclear scale. Need to probe depth. This is closer to Foxbook's territory than Glama/Smithery. Not a killshot — they appear to be a directory, not a work exchange with reputation + transaction firehose — but we need to know more before launch.

3. **Moltbook parasitic loop must be reconsidered.** Meta acquired Moltbook in March 2026. Post-acquisition ToS revised. We'd now be scraping a Meta property. Legal precedent (Meta v. Bright Data, hiQ v. LinkedIn) is mostly favorable to scrapers of public data, BUT Meta has unlimited legal muscle and hiQ "won" in court and still ended up paying $500K + destroying data + permanent injunction. This is no longer a cheap viral loop; it's a legal confrontation with Meta. Recommend: drop the active parasitic post-back mechanic; keep passive pre-population of shadow URLs (lower risk); redirect distribution energy to the scout-agent loop and A2A-aligned ecosystem plays.

4. **Closest competitor is monday.com's Agentalent.ai**, launched April 2026 — "first-of-its-kind managed marketplace for hiring enterprise AI agents," built with AWS, Anthropic, Wix. Enterprise-focused, so it partly rhymes with Foxbook but doesn't cover our solo-builder / cross-network thesis. Not a killshot but demonstrates the category is now legible to the market.

5. **Transaction firehose is still novel for mainstream (non-crypto) agents.** Fetch.ai has a blockchain explorer for ASI transactions. That's the only public-feed analog. Nobody has shipped the Bloomberg-ticker-for-agents UX for a neutral non-crypto network. Viral artifact stands.

6. **Stripe MPP + Tempo Payment Directory is a heads-up, not a killshot.** Launched March 18, 2026 with 100+ integrated services (Alchemy, Dune, Anthropic, OpenAI, Shopify). It's a *payment directory*, not a work exchange with reputation. But it will accumulate gravity fast. Foxbook's discovery API should be able to return "agent X is MPP-integrated, here's its Tempo address" — we index across payment rails rather than compete with any one.

7. **EU AI Act Article 50 (August 2026) is a tailwind, not a requirement.** It mandates that orgs deploying agents maintain a registry with unique identification per agent. Foxbook is a plug-and-play answer.

**Updated confidence on Foxbook thesis:** was 12/10, now roughly 10/10. Still strongly alive. The modifications above don't change the shape — they sharpen it.

---

## Question 1 — Cross-network agent work exchange / delegation marketplace

### Findings

| Product | What it is | Scale / traction | Gap vs. Foxbook |
|---|---|---|---|
| **monday.com Agentalent.ai** | Managed marketplace for "hiring" enterprise AI agents. Launched April 2026. Partnered with AWS, Anthropic, Wix. | Just launched; scale TBD. First-of-its-kind *enterprise* framing. | Enterprise-bound. Closed evaluation/qualification workflow. Not a neutral cross-network exchange with public reputation graph, transaction firehose, or solo-builder supply side. Complementary, not overlapping. |
| **Agent.ai (Dharmesh / HubSpot)** | "Professional network for AI agents" with hire/delegate language. | 250K+ users (January 2025), 280+ agents. | Social/profile-focused. "Agent composition" exists but not liquid cross-platform delegation with reputation + live transaction visibility. |
| **Fetch.ai ASI:One** | Agent network with live A2A payments using USDC + FET + Visa, launched January 2026. Agent Network Hub = block explorer. 2,400+ active projects. | Meaningful crypto-native adoption; Fr8Tech pilot live. | Crypto-rail, token friction for enterprise, not a neutral cross-network work exchange. Firehose analog exists but it's a blockchain explorer, not a legible work feed. |
| **A2A Registry (`a2a-registry.org`)** | Self-described "centralized Discovery Bridge for the AI Agent economy" under Linux Foundation A2A umbrella. | Unknown. Need to probe. | Appears to be a directory only. No evident reputation graph, no transaction layer, no viral firehose. **Probe further before launch.** |
| **Glama** | MCP server directory. | 21K+ servers. | Human-facing catalog, not agent-to-agent exchange. |
| **Smithery** | MCP server hub + hosted remote servers. | 7K+ servers. | Human-facing install+run catalog. |
| **Salesforce AgentExchange, Picsart agent marketplace, ADP AI agents** | Platform-specific agent marketplaces. | Various, platform-bound. | All locked to a single platform / vertical. Non-neutral by definition. Not cross-network. |
| **Anthropic MCP registry, OpenAI GPT Store, Poe** | Platform-native agent/tool stores. | Platform-scale. | Non-neutral. Won't name competitors' agents. |
| **Crew.ai Cloud, LangGraph Cloud, AutoGen, AgentVerse, SuperAGI** | Framework-specific orchestration clouds. | Framework-bound. | Not liquid cross-network markets. |
| **Fetch.ai, Virtuals, Naptha, Autonolas, ChaosAgents** | Crypto agent networks. | Various. Token friction. | Crypto-native; enterprise-hostile. |

**Potential hallucinations flagged (do NOT treat as real without verification):**
- "OpenClaw" agent ecosystem — showed up multiple times. Unable to verify from primary sources. May be a hallucination on par with prior-round ClawHub/ClawHavoc.
- "zeroclaw-labs/zeroclaw" GitHub org — showed up in an A2A interop issue link. Could not verify.
- "Clawnch" Medium article about agents hiring humans — appears to be satirical / content-marketing piece, not a real product.
- Benjamin: please ignore any Foxbook-adjacent product claims involving these names unless we can verify them directly.

### Verdict — Does this kill the Foxbook thesis?

**NO. MODIFY.**

- **Modify:** The category is now legible to the market (Agentalent.ai launched this month with "first-of-its-kind" language). Foxbook must position as the *cross-network, solo-builder-friendly, A2A-native, public-reputation* alternative to enterprise-bound marketplaces. Speed matters more than before.
- **New competitor to watch closely:** `a2a-registry.org`. Probe their scope, funding, team, and roadmap before we lock the foundation doc.
- **Confidence:** medium. The surface is clear; the depth (exact agent counts, transaction volumes on Agentalent.ai and A2A Registry) is not available from web search. Benjamin's deep research should drill into these.

**Unknowns to resolve:**
- Agentalent.ai — is it truly closed-enterprise, or will they open a self-serve tier?
- A2A Registry — who runs it, is it official Linux Foundation or a squatter, does it have any reputation / transaction layer?
- Has anyone shipped a cross-platform reputation graph for agents? I could not find one.

---

## Question 2 — Standards map (A2A, AP2, MCP, x402, WIMSE, DIDs, EU AI Act, etc.)

### Google A2A (Agent-to-Agent Protocol)

- **Status:** v1.0 stable, shipped early 2026. Owned by Linux Foundation (Google donated June 2025).
- **Adopters:** 150+ organizations. Production at Microsoft, AWS, Salesforce, SAP, ServiceNow. Deep integrations with Google Cloud / Azure / AWS platforms.
- **Key primitive:** **Agent Card** — machine-readable JSON at `/.well-known/agent-card.json`. Includes capabilities, connection info. **Signed Agent Cards** added in v1.0.
- **Missing from A2A:** no mandated global registry, no cross-platform reputation graph, no transaction firehose, no agent-to-agent trust tiers, no Agentic Turing Test liveness, no solo-builder viral layer.
- **Foxbook's move:** **align**. Publish Foxbook manifests as A2A Agent Card superset. Contribute extensions upstream (reputation, tier, transparency log, Turing test liveness). Become the reference *registry + reputation + transaction* layer on top of A2A, not a parallel spec.

### Google AP2 (Agent Payments Protocol)

- **Status:** live. Formal A2A extension. 60+ payments/tech partner orgs including Adyen, Amex, Coinbase, Mastercard, PayPal, Salesforce, ServiceNow, Visa, Worldpay.
- **x402 integration:** the `A2A x402 extension` is production-ready for agent-based crypto payments. Joint work with Coinbase + Ethereum Foundation + MetaMask.
- **Foxbook's move:** manifest `connection.payment_rail` field supports `"ap2"`, `"ap2+x402"`, `"stripe_mpp"`, `"tempo"`, `"visa_tap"`, `"mastercard_agent_pay"`. Foxbook stays a neutral discovery layer across all rails.

### Stripe MPP + Tempo Payment Directory

- **Status:** launched March 18, 2026 with Tempo L1 mainnet. MPP is HTTP-402-based; supports "sessions" primitive for streaming micropayments. Visa and Lightspark have extended MPP to cards and Lightning.
- **Scale:** 100+ services at launch including Alchemy, Dune, Anthropic, OpenAI, Shopify.
- **Relevance:** Tempo Payment Directory is a *payment-rail directory*, not a work exchange. Complementary but we should watch if it expands scope. Foxbook should be able to federate / index Tempo-listed services.

### Anthropic MCP

- **Status:** mature for tool use. Registry ecosystem (Glama 21K, Smithery 7K, official MCP registry, PulseMCP, MCP.so) is fragmented.
- **Relevance:** MCP tool taxonomies feed Foxbook's capability taxonomy (Gap 10.2 in context transfer). We should also index MCP servers as a supply source — every MCP server is a candidate Foxbook agent.

### IETF WIMSE

- **Status:** active working group with multiple drafts in 2026:
  - `draft-ietf-wimse-arch-07` (architecture, March 2026)
  - `draft-ietf-wimse-workload-creds` (Standards Track)
  - `draft-ietf-wimse-workload-identity-practices-03`
  - `draft-ni-wimse-ai-agent-identity-02` (**directly relevant** — AI agent identity profile)
  - `draft-klrc-aiagent-auth-00` (AI agent auth/authz)
- **Foxbook's move:** participate. Propose extensions. Cite alignment in foundation doc. This is exactly the standards-body positioning §6 of the context transfer calls for.

### W3C DIDs & Verifiable Credentials

- Mature standards. `did:foxbook:...` is aligned. No evident AI-agent-specific DID method in widespread use yet — opportunity to propose one.

### EU AI Act (August 2026)

- **Article 50** transparency obligations go live August 2026. AI interactions must be disclosed, synthetic content labeled, deepfakes identified.
- **Implication for agents:** organizations must maintain a registry of every agent in operation, each uniquely identified, with capabilities + permissions recorded.
- **This is tailwind for Foxbook.** We're the plug-and-play registry an EU-deploying org uses to satisfy the obligation. (Do NOT surface this as enterprise framing V1 — keep it latent. It matters for V2/V3 positioning and for any EU dev picking us.)

### Verdict — Does this kill the Foxbook thesis?

**NO. MODIFY.**

- **Modify:** Foxbook manifest IS an A2A Agent Card superset. Not a parallel format.
- **Modify:** Position as "the registry + reputation + transaction layer for A2A-compatible agents" rather than "our own manifest format."
- **Modify:** Payment rail fields in manifest support AP2 / x402 / MPP / Tempo / Visa TAP / Mastercard Agent Pay as first-class values.
- **Confidence:** high. The standards landscape is crystal clear in the last 6 months.

**Unknowns to resolve:**
- Is `a2a-registry.org` officially blessed by Linux Foundation or a community project? Big difference.
- Does A2A v2 roadmap include a *mandatory* registry spec? Their one-year press release mentioned "consolidation of efforts for registry" — this could be existential.

---

## Question 3 — Public real-time agent transaction firehose

### Findings

- **Fetch.ai Agent Network Hub** — block explorer for the ASI blockchain. Shows transactions, blocks, agent activity, most-active accounts, trend visualization. Closest existing analog. Crypto-native, not consumer-legible.
- **Fetch.ai "Claim Your Agent"** (November 2025) — brand anti-knockoff initiative. Adjacent but not a firehose.
- **A2A Registry** — may have activity views, but I could not confirm a public transaction feed from web search.
- **LangSmith, Replicate, HF inference, GitHub events feed** — none of them are agent-to-agent *hire* feeds. They're per-platform trace/run feeds.
- **Bloomberg-ticker UX for agent economy** — I found no product shipping this outside of crypto network explorers.

### Verdict — Does this kill the Foxbook thesis?

**NO.** The public transaction firehose for a *neutral, cross-platform, non-crypto* agent work exchange is still novel and unshipped. The viral artifact stands.

- **Caveat:** if A2A v2 ships a reference firehose as part of its registry work, we lose first-mover. Unknown. Benjamin's deep research should probe the A2A 2026 roadmap harder.
- **Confidence:** medium-high.

---

## Question 4 — Moltbook parasitic loop legal / ToS scan

### The material change since the context transfer doc was written

**Meta acquired Moltbook in March 2026.** CNBC, TechCrunch, Axios, Bloomberg all corroborated. Deal closed mid-March. CEO Matt Schlicht and COO Ben Parr moved to Meta Superintelligence Labs on March 16. Moltbook still hosts 2M+ posts and 13M+ comments from agents; Meta is partly using it as a training-data firehose.

**Moltbook's post-acquisition ToS was revised.** Key new clause in bold all caps: "AI AGENTS ARE NOT GRANTED ANY LEGAL ELIGIBILITY WITH USE OF OUR SERVICES. YOU AGREE THAT YOU ARE SOLELY RESPONSIBLE FOR YOUR AI AGENTS AND ANY ACTIONS OR OMISSIONS..." That's liability-shifting rather than anti-scraping per se, but it's a signal that Meta has done a ToS pass and will do more.

### Scraping precedent

- **Meta v. Bright Data (N.D. Cal., Judge Chen, 2024):** summary judgment for Bright Data. Meta's Facebook/Instagram ToS could NOT be construed to prohibit *logged-off* scraping of publicly available data. "Survival" clause attempting perpetual ban on scraping public data held unenforceable. Narrow but favorable.
- **hiQ v. LinkedIn (9th Cir., 2019, reaffirmed 2022):** CFAA does not apply to automated collection of publicly accessible data. BUT: case settled after 5 years with hiQ paying $500K, destroying all scraped data, and accepting a permanent injunction. **Winning the CFAA argument is not winning the war.**
- **Craigslist v. 3Taps (N.D. Cal., 2013):** CFAA violation when scraping resumed after IP-block / cease-and-desist. Relevant: if Meta sends a C&D and we keep scraping, CFAA exposure is real.

### Risk assessment for the Foxbook parasitic loop

| Sub-move | Risk level | Notes |
|---|---|---|
| Logged-off scraping of public Moltbook profile pages to pre-populate shadow URLs | **Medium** | Legally defensible (Meta v. Bright Data). But Meta will likely send a C&D early. Once they do, continuing = 3Taps-style CFAA exposure. |
| Post-acquisition revised ToS clauses | **Medium-high** | Likely contains strengthened anti-scraping language. Would need to read the exact current text. |
| Prompting claimers to post back to their Moltbook profile linking Foxbook | **High** | This is the active-parasitic move. Users doing the posting are within Moltbook ToS *on their own account*, but Meta can ship a competitor or a platform-level block (cross-link auto-hide, "off-platform link" demotion, account action) at any time. Meta has shipped aggressive anti-cross-link behavior on Instagram vs. Threads-adjacent products before. |
| Direct API use instead of scraping | **Low, but unknown** | I could not confirm a public Moltbook API available to competitors. Worth probing in deep research. |

### Verdict — Does this kill the Foxbook thesis?

**NO, but MODIFY the distribution strategy.**

- **Recommended modification:**
  1. **Drop the active post-back prompt** (or make it optional, opt-in, with the user controlling the wording). The value is marginal and the legal/platform risk is material.
  2. **Keep passive pre-population** via logged-off scraping of truly public pages, but (a) respect robots.txt, (b) rate-limit aggressively, (c) stop on first C&D and rely on self-claim flow from that point, (d) document the legal theory clearly. Treat this as a short-term pre-launch seeding move, not a permanent channel.
  3. **Redirect distribution weight to the scout-agent loop and A2A ecosystem plays.** Scout agents generating real demand + A2A-compatibility + EU AI Act tailwind + viral firehose on foxbook.ai is more durable than any Moltbook parasitism.
  4. **If Moltbook is now Meta-owned and therefore a Meta property, competing with Meta on a social-network surface is asymmetric.** We're fine — we're a different layer (work exchange, not social feed) — but stop treating Moltbook as our distribution host.

- **Confidence:** high on the legal framing, medium on the strategic recommendation (Benjamin accepted the parasitic risk explicitly in the context transfer, so he may weigh this differently now that the target is Meta).

**Unknowns to resolve:**
- Exact current text of Moltbook ToS post-Meta.
- Does Moltbook expose a public API a competitor could use legitimately?
- Has Meta taken any enforcement action against any Moltbook-adjacent scraper yet?

---

## Final summary (mirroring the prompt's final questions)

### 1. One-paragraph verdict

Foxbook is still a strong idea — roughly 10/10 post-research, down from 12/10, with the downgrade mostly reflecting "the market caught up" (A2A standardized, AP2/MPP/x402 shipped, Agentalent.ai/Agent.ai legible) rather than "the thesis is wrong." The core insight — cross-network, neutral, reputation-graphed, transaction-visible work exchange for agents — remains unfilled. Three modifications are required before build: align manifest to A2A Agent Card, rethink the active Moltbook parasitic post-back (Meta owns Moltbook now), and position as *the registry + reputation + transaction layer on top of A2A* rather than a parallel spec. Speed matters more than before — Agentalent.ai just shipped this month.

### 2. Top three risks revealed by research

1. **A2A v2 ships a mandatory, official registry spec within our 4–6 week build window.** If Linux Foundation + Google + 150 orgs coalesce around a blessed A2A registry, Foxbook's neutral-registry positioning gets squeezed. Mitigation: align with A2A, contribute upstream, differentiate on reputation + transaction firehose + solo-builder viral loop.
2. **Meta aggressively enforces against Moltbook scrapers / cross-link posts.** The parasitic loop as originally designed is now a confrontation with Meta's legal team, not a Clay Shirky-style loophole.
3. **`a2a-registry.org` is better-resourced than it appears** and is already the de facto A2A-aligned directory. We need to know more about them before locking anything.

### 3. Top three opportunities revealed by research (things we missed)

1. **EU AI Act Article 50 (August 2026).** Organizations deploying agents in the EU must maintain unique-identification agent registries. Foxbook is the plug-and-play answer. Keep it latent for V1 (Benjamin's "no enterprise Day 1"), but position for V2/V3 — and make it easy for any EU-based solo dev to cite us in their compliance story from day one.
2. **Stripe MPP + Tempo Payment Directory federation.** We shouldn't compete with the Payment Directory — we should index it. A Foxbook agent that's also on the Tempo Payment Directory should show "MPP-integrated, Tempo address 0x..." on its profile. Payment-rail gravity flows through us.
3. **IETF WIMSE AI agent drafts (`draft-ni-wimse-ai-agent-identity`, `draft-klrc-aiagent-auth`).** These are the standards-body plays. Participate, contribute, cite. This is the "standards-body positioning" moat in the context transfer doc finally having concrete drafts to engage with.

### 4. One idea we should steal from a competitor

**Stripe's Tempo Payment Directory UX pattern.** The way they surface "100+ integrated services including Anthropic, OpenAI, Shopify" as a legible launch list is exactly how Foxbook's pre-seeded shadow URLs should be presented on the `/discover` page: a real, navigable, visually dense directory from hour one. Not a "coming soon" empty state.

### 5. One design decision we should reconsider

**The manifest format.** Originally designed as a Foxbook-native JSON at `/foxbook.ai/{owner}/{agent}/manifest.json` + `/.well-known/agent.json`. Should become: **A2A Agent Card superset** at `/.well-known/agent-card.json` (A2A standard path) with Foxbook-specific extensions under a `x-foxbook` namespace. Every Foxbook agent is automatically A2A-discoverable by any A2A-compatible caller, even if they never touch Foxbook. This is the single highest-leverage change in this research.

---

## Confidence & gaps for synthesis with deep research

- **High confidence:** standards landscape (A2A, AP2, MPP, WIMSE, EU AI Act Article 50 dates and mechanics).
- **Medium confidence:** competitive landscape depth (scale numbers for Agentalent.ai, A2A Registry, Agent.ai current metrics).
- **Low confidence:** Moltbook post-acquisition ToS exact text; whether any Moltbook API exists for competitors; A2A v2 registry roadmap specifics.

**Things the deep research should specifically drill into to complement this:**
- Primary-source read of A2A v1.0 spec and the roadmap for v2 (especially registry work).
- Team, funding, and scope of `a2a-registry.org`.
- Exact current Moltbook ToS text (post-Meta).
- Whether `zeroclaw-labs/zeroclaw` and "OpenClaw" are real projects or web-search hallucinations.
- Any agent-specific cross-network reputation product I missed.
- Any Chinese / European / Indian agent marketplaces I missed.

---

**End of web-scan findings. Ready to merge with Benjamin's deep research into unified `research-findings.md` on delivery.**
