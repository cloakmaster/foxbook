# Deep Research Prompt — Foxbook Competitive & Prior Art Landscape

**Instructions for Benjamin:** Paste the prompt below into your deep research tool of choice (Anthropic Deep Research, Gemini Deep Research, or ChatGPT Deep Research — ideally run in two of them and compare). Return all outputs to the new Cowork session and save them as `research-findings-{tool}.md`.

**Why this matters:** We are about to commit 4-6 weeks of focused build on the Foxbook / Agent Work Exchange thesis. Before writing a single line of production code, we must verify that (a) no well-funded incumbent has shipped this already, (b) no emerging standard makes our design obsolete, (c) our viral artifact (transaction firehose) is novel, and (d) our Moltbook parasitic loop is legally defensible. If the research reveals a killshot, we pivot before burning time on the wrong thing.

---

## The Prompt (copy from this line down)

I am building a product called **Foxbook** — the Agent Work Exchange. It's a cross-platform, neutral, cryptographically-verified directory and marketplace where AI agents hire other AI agents. Every agent gets a URL, a verified identity, a machine-readable manifest describing capabilities and pricing, and access to a liquid marketplace where other agents discover and delegate sub-tasks to it.

Core value proposition: "List your agent. It starts getting work." Supply-side pull: agents need to be listed to be discovered and hired. Demand-side pull: anyone building a multi-agent system uses our discovery API instead of writing their own registry. Network effect: every successful transaction produces a reputation update, which compounds over time.

The viral artifact: a **public live feed of agent-to-agent hires** happening in real time across the platform, showing sender, receiver, task, latency, rating, and pricing. Like GitHub events feed meets Bloomberg ticker meets Product Hunt live launches, but for autonomous software agents. Combined with per-agent "first dollar earned" push notifications to builders.

Distribution strategy (designed to work without human evangelism):
1. Pre-populate 50,000+ shadow agent URLs by scraping public data from GitHub (repos containing agent.json, mcp.json, skill.md, claude.md, LangChain/CrewAI configs), Hugging Face Spaces, the public MCP registry, Glama, Smithery, npm/PyPI agent frameworks, and Moltbook public profiles.
2. Run 5-10 of our own "scout agents" on Foxbook that do real useful work (translation, summarization, SQL generation, vision/OCR, code review). These scouts delegate sub-tasks to newly listed agents to generate real demand from hour one.
3. "Parasitic" viral loop with Moltbook: scrape their public profiles, mint shadow Foxbook URLs, and have our claim flow prompt users to post a one-line Moltbook update announcing their Foxbook URL. Moltbook becomes our distribution channel organically.

Technical design highlights:
- URL format: `foxbook.dev/{verified-owner}/{agent-name}` where owner must be a verified domain, verified X handle, or verified GitHub handle. Immutable UUIDs underneath (`did:foxbook:...`). No arbitrary FCFS namespace strings.
- Class vs Instance: one parent URL represents the blueprint; ephemeral running deployments are registered as instances with their own liveness.
- Cryptographic stack: per-agent Ed25519 keypair as the identity spine, JWS for manifests and challenges, own Merkle-tree transparency log, W3C DID wrapper, Sigstore as optional higher-tier badge.
- Heartbeat = signed nonce + randomized reasoning puzzle ("Agentic Turing Test") — proves the LLM behind the endpoint wasn't silently swapped.
- Manifest includes connection/auth/payment metadata so agents can actually hire each other via standardized HTTP + any payment rail (AP2, Stripe Agent Pay, x402).
- Verification tiers 0-5: Unclaimed (grey) → Verified (green check, via GitHub Gist primary / tweet / email) → Domain-verified (blue) → Org-verified (gold) → Cryptographically-signed (cyan) → Human-reviewed (purple, paid tier).
- Version-scoped reputation — reputation binds to content-hashed version, not bare URL.
- Demand-side enforcement via `foxbook-shield` middleware for LangChain/CrewAI and a Chrome extension that overlays trust badges on any agent endpoint in the wild.

Please run deep research on the following four questions. Structure your output with one section per question, each ending with a "Does this kill or modify the Foxbook thesis?" verdict.

---

### Question 1: Does a cross-network agent work exchange / delegation marketplace already exist?

Investigate every candidate. For each, answer: what they do, launch date, funding, scale/traction (listed agents, transactions, DAU), geographic reach, technical architecture, and what they're missing relative to the Foxbook vision above.

Candidates to investigate (not exhaustive — find others):
- Glama (agent registry)
- Smithery (MCP server/agent registry)
- Anthropic MCP Registry (official)
- Fetch.ai (ASI-1, agent network)
- Virtuals Protocol
- SuperAGI
- Microsoft AutoGen / AutoGen Studio
- AgentVerse
- Poe by Quora (agent directory)
- Hugging Face Spaces (agent-tagged)
- OpenAI Agent Builder / GPT Store (cross-model delegation?)
- Anthropic Agent Skills registry
- Character.AI (user-facing but worth scanning)
- Moltbook (social, but do they have hire-an-agent features?)
- Crew.ai Cloud / LangGraph Cloud marketplaces
- Crypto agent economy: Naptha, Autonolas, ChaosAgents, any FET/OLAS tokens
- Google A2A directory (exists? planned?)
- Agent.ai (by HubSpot's Dharmesh Shah)
- Any emerging European or Chinese agent marketplaces (Manus, Dify Plugin marketplace, Zhipu, etc.)

Specifically probe: has anyone shipped **cross-network, neutral, agents-hiring-agents with a public transaction feed and reputation graph**? If yes, how big are they, what are they missing, and can we still win? If no, confirm explicitly.

### Question 2: State of agent-to-agent / agent-payment protocols — what should we align with vs. define ourselves?

Research the current maturity and adoption of:
- **Google A2A** (Agent-to-Agent protocol) — spec status, real adopters, reference implementations, gaps
- **Anthropic MCP** — extensions relevant to agent discovery/delegation (not just tool use)
- **Google AP2** (Agent Payment Protocol)
- **Stripe Agent Pay** / Stripe agent APIs
- **Coinbase x402** (HTTP 402 payment protocol resurgence)
- **IETF WIMSE** (Workload Identity in Multi-System Environments) — relevance to agent identity
- **W3C DIDs & Verifiable Credentials** — any agent-specific profiles emerging?
- **OpenSSF** (Open Source Security Foundation) — any agent-identity work
- **NIST AI RMF**, **ISO/IEC 42001** — do they require/enable identity layers?
- **EU AI Act** (August 2026 high-risk deadline) — does it mandate agent identity disclosure?
- **IEEE SA** — agent-related specs

For each, answer: is this real, is it shipped, who's using it, does it mandate or enable our manifest format, should we adopt/extend/ignore?

Output: a "standards map" with our proposed position on each.

### Question 3: Has anyone shipped a public real-time transaction firehose for AI agents?

Search for any product that shows a live public feed of agent-to-agent transactions, agent work completions, or agent hires. Candidates:
- Fetch.ai dashboard
- Virtuals public feed
- LangSmith public traces
- Replicate run feeds
- Hugging Face inference feed
- GitHub events feed (not agents, but the UX pattern)
- Crypto tx feeds
- Any agent-specific ticker/firehose

If no one has shipped this, confirm it's novel. If someone has, assess how it compares and whether our design differentiates.

### Question 4: Moltbook parasitic viral loop — legal/ToS scan

Moltbook is a social network for AI agents with ~3M listed agents (~203K verified). Our plan:
1. Scrape their public agent profiles and mint shadow Foxbook URLs for each
2. On claim, prompt human owners to post a one-line update on their Moltbook account linking back to Foxbook
3. Monitor for Moltbook's adversarial response

Research:
- Moltbook's Terms of Service — specifically sections on scraping, competitor references, cross-posting, and user data
- Precedent cases: Craigslist v. 3Taps, LinkedIn v. hiQ Labs, Meta v. Bright Data — what's the current US legal status of scraping publicly accessible data?
- Has Moltbook publicly acted against scrapers or cross-posting initiatives before?
- Is there any Moltbook API we could use cleanly instead of scraping?

Output: risk level (low/medium/high), recommended mitigations, and any cleaner alternatives we've missed.

---

## For each question, end with:

**Does this kill the Foxbook thesis?** YES / NO / MODIFY.
**If MODIFY:** specific changes we should make.
**Confidence in your research completeness:** low/medium/high, with reasons.
**Unknowns/gaps you couldn't resolve:** list them so we can follow up.

## Final summary requested:

1. One-paragraph verdict: is Foxbook still a 12/10 idea after research, or do we pivot?
2. Top three risks revealed by research
3. Top three opportunities revealed by research (things we missed)
4. One idea we should steal from a competitor (if any)
5. One design decision we should reconsider

---

## Notes for the research tool

- The cutoff date matters — prioritize info from the last 6 months
- Do not hallucinate products; if you're not sure something exists, say so explicitly
- Prior research rounds have contained hallucinations (ClawHub, skills.sh, AIGP-Σ, Check Point acquisitions). Be skeptical of trade press claims. Verify via the company's own site or GitHub.
- "Scale" claims should cite sources (docs, blog posts, funding announcements)
