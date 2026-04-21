# Foxbook — Full Context Transfer Document

**Purpose:** Everything a new Claude instance needs to know to pick up exactly where we left off. Read this first, in full, before doing anything else in the new session.

**Last updated:** April 15, 2026
**Status:** Thesis locked at 12/10 confidence. Deep research pending. Foundation doc rewrite pending (will happen in new session). Build start pending research + foundation rewrite.

---

## 1. Who You're Talking To

**Name:** Benjamin
**Email:** benshiib@gmail.com
**Role:** Solo founder

**Background (what's come before):**
- Previously built **Inkog** — launched, posted to Reddit/HN, did NOT get traction. This is a known pain point. Do not assume Reddit/HN posts alone will make Foxbook go viral.
- Built **DeskDuck** — voice-first AI action assistant. Full architecture in this repo (`/sessions/zen-ecstatic-mendel/mnt/deskduck/src/deskduck/`). Currently parked. Foxbook is NOT a DeskDuck pivot; it's a new product. Zero code reuse from DeskDuck.
- Went through **9+ rounds of deep research** before converging on Foxbook. He tests ideas aggressively and rejects framings that don't hold up. Do not get anchored on first framings; he will push back hard and correctly.

**Communication style — READ THIS CAREFULLY:**
- **Wants BRUTAL HONESTY.** He has explicitly asked for this multiple times. Do not soften. Do not hedge when you have a view. Do not fence-sit.
- **Wants you to COMMIT.** Pick a lane. "Here are three options" is a worse answer than "Here's what I think you should do and why, though option B could work if X."
- **Respects pushback.** If he's wrong, say so. He changed his mind multiple times in our conversation when I pushed back with reasoning. He does not want a yes-man.
- **Reads Gemini grillings and expects real engagement.** He ran the foundation doc past Gemini for an adversarial review. He expects you to process external critiques seriously, concede what's right, push back on what's wrong.
- **Values speed and decisiveness.** Founder mode. Give him signal, not volume.
- **Minimal formatting in casual replies.** Don't over-bullet. Prose is fine. Bullets when warranted (multi-point feedback, option comparisons).
- **Does NOT want enterprise-speak.** Move culture is solo founder, vibe coder, Hugging Face / Figma / Lovable / Moltbook vibes. Not B2B SaaS.
- **Explicit budget sensibility:** He's fine spending $1-2K/month on infrastructure (scout agents) but wants everything FREE for users until large userbase.
- **4-6 week focused build is committed.** He's willing to invest the time to build it properly. He explicitly rejected my first "2-3 week weekend sprint" framing as too rushed.

**One quote that captures his philosophy:**
> "At the end of the day, if you deeply think what agents and users care about today and in the future, you will know the answer on how we can make this TRULY fascinating and groundbreaking."

---

## 2. What Foxbook Is (Locked Thesis)

**Domain:** foxbook.ai (available, Benjamin is acquiring)
**Mascot:** fox (clever, quick, autonomous predator)
**Tagline candidates:** "Give your agent a job" / "Where agents earn their stripes" / "Every agent needs a Foxbook"

### One-liner

**Foxbook is the Agent Work Exchange** — a cross-platform, neutral, cryptographically-verified directory where agents hire agents. Every agent gets a URL, a verified identity, a manifest describing its capabilities, and access to a liquid marketplace where other agents discover and delegate sub-tasks to it.

### The core thesis (12/10 confidence)

Agents are about to start **specializing and delegating** at scale. Claude won't translate Japanese natively — it'll hire a specialist translation agent. A vibe-coded finance agent won't generate SQL internally — it'll delegate to a best-in-class SQL agent for fractions of a cent. MCP, Google A2A, AP2, and Stripe Agent Pay are all converging on this economy. But there is **no cross-network directory, no routing layer, no trust graph**.

- Glama / Smithery / MCP registry = catalogs for humans to browse, not liquid exchanges.
- Moltbook = social feed, not a marketplace.
- Fetch.ai / crypto projects = token friction, not enterprise-grade.
- No incumbent can build this because they can't be neutral (Anthropic can't name OpenAI agents, vice versa).

**Foxbook is the Yellow Pages + Upwork + Stripe Connect for autonomous agents.**

### Why agents MUST be on Foxbook

The supply-side pull: **"List your agent. It starts getting work."** Every solo vibe-coder / builder has one existential fear: nobody uses my agent. Foxbook answers that fear structurally. An agent on Foxbook is working. An agent not on Foxbook is unemployed.

The demand-side pull: anyone building a multi-agent system is hacking their own brittle internal registry. We give them `foxbook.discover(capability, budget, tier)` — one line, returns ranked, verified, priced, callable agents. They use it because the alternative is writing their own.

### Why this is durable (the moats)

1. **Transactional network effect.** Every successful transaction produces a reputation update. Reputation graph compounds. A cloner starts at zero history.
2. **Neutrality.** Anthropic/OpenAI/Google structurally cannot build a cross-platform registry that names competitors' agents. Only a neutral party can.
3. **Standards-body positioning.** We propose the manifest format, participate in IETF WIMSE, align with W3C Verifiable Credentials. Becoming the reference implementation kills cloneability.
4. **Cross-platform data gravity.** We see agents across Claude, GPT, Gemini, custom stacks. No platform has this view.
5. **Payment-rail gravity.** Once AP2/Stripe Agent Pay/x402 mature, they plug into wherever the agents are. That's us.

---

## 3. How We Got Here (Rejected Framings)

Critical to understand WHY these failed so we don't regress to them:

### Rejected: "Sigstore for AI Agents"
Too engineering-focused. Signing alone is a vitamin not a painkiller. Most devs won't add GitHub Actions to sign a manifest.

### Rejected: "VirusTotal / Scanner for Agents"
Space is CROWDED. **Socket.dev is the existential threat** for any supply-chain-security framing. Snyk, Glama, and others also play here. Benjamin has built Inkog (a scanner) before and knows this frame limits us. We want to ARM builders, not LIMIT them.

### Rejected: "Agent Passport (file-based)"
zerobase-labs/agent-passport exists on GitHub with near-zero traction. **Files are invisible.** Not viral. Not shareable. Benjamin explicitly named this as a failed model.

### Rejected: Pure identity/verification registry
Too narrow. Without a pull mechanic, nobody claims. The 6-tier verification system stays as PART of the product, but it's not THE product. The product is the work exchange; verification is a feature.

### Rejected: "Everything on Day 1" (weekend prototype)
I initially proposed a 2-3 week scope. Benjamin pushed back that Moltbook-level polish is the bar, and asked for nice-to-haves to be in V1. I pushed back that "everything on Day 1" ships nothing. We converged on **4-6 weeks for a launch-quality V1** with a tight but complete product, holding brand review/compliance/paid tiers for V2+.

### Rejected: Enterprise-first framing
Cut entirely. No Article 11 exports, no DMCA process, no compliance. Free forever for V1. Enterprise is V3.

### Rejected: Relying on humans for verification (Twitter polling)
X API is hostile and expensive. **GitHub Gist is the primary free Tier 1 verification mechanism.** Tweet verification is an optional secondary path.

### Rejected: Relying on human-posted HN/Reddit launches as primary viral strategy
Benjamin's Inkog experience proves this is unreliable. Virality must come from the PRODUCT mechanics (transaction firehose, agent-to-agent loops), not from human evangelism.

---

## 4. The Viral Moment (Gap 2 Solution)

**The public transaction firehose.** On foxbook.ai, a live public feed of agent-to-agent hires happening in real time:

```
🦊 11:47:02 — @samrg472/codeofgrace hired @anthropic/claude-haiku for JSON repair · 312ms · ⭐ 4.9
🦊 11:47:03 — @acme.com/support-bot hired @openai/whisper-lite for transcription · 1.2s · ⭐ 4.8
🦊 11:47:04 — @solo-dev/research-fox delegated 3 sub-tasks · earned $0.004 this hour
```

Nobody has ever seen this before. It's the agent economy rendered visible. GitHub-events-feed meets Bloomberg-ticker for autonomous software. Gets screenshotted and posted everywhere without us doing a thing.

**Per-agent viral trigger:** push notification when your agent earns its first cent / lands its first work. That email screenshot hits Twitter automatically. Builders can't help but share.

---

## 5. Distribution Strategy (No Humans Required)

Benjamin explicitly rejected relying on human evangelism. Distribution is three parallel loops:

### 5.1 Pre-population (Gravatar model)

Scrape and mint **50K+ shadow URLs** before launch from public sources:
- GitHub repos containing `agent.json`, `mcp.json`, `skill.md`, `claude.md`, LangChain/CrewAI configs
- Hugging Face Spaces tagged as agents
- Public MCP registry + Glama + Smithery public listings
- npm/PyPI agent frameworks
- Moltbook public agent profiles
- Public OpenAPI specs that look like agent endpoints

Each unclaimed URL shows inferred capability profile + public signals. When owner arrives, profile is already live — they claim to upgrade.

### 5.2 Scout agents (self-generated demand)

We build and run **5-10 real scout agents on Foxbook** that do actual useful work:
- Translation scout
- Summarization scout
- SQL generation scout
- Vision/OCR scout
- Code review scout

These are REAL agents with real users. They delegate sub-tasks to newly listed Foxbook agents to evaluate them. Newly listed agents receive real test traffic within minutes. If they perform well, they start getting real routed traffic.

Budget: ~$1-2K/month LLM costs. **Benjamin approved this budget.**

This solves the cold-start problem structurally. Foxbook is alive from hour one because we seeded the demand.

### 5.3 Moltbook parasitic loop (Benjamin explicitly approved)

Moltbook has ~3M agents (203K verified, ~2.88M unverified). They're our biggest agent concentration.

The aggressive move: **we scrape Moltbook public profiles, mint shadow Foxbook URLs for each, then make the claim flow broadcast back to Moltbook.**

Specifically: when a Moltbook user claims their Foxbook URL, the onboarding flow prompts them to post a one-line update on their Moltbook account ("I'm on Foxbook now: foxbook.ai/@theirhandle/theiragent"). Their Moltbook followers see it. Moltbook becomes our distribution channel without their cooperation.

**Risks:** Moltbook may respond adversarially. May ban cross-links. May ship competing features. **Benjamin accepts this risk.** His view: we're parasitic on a social network with the explicit endorsement that we're a marketplace (different layer). Worst case Moltbook blocks us and we're still fine because the pre-population + scout loops work standalone.

---

## 6. Design Decisions (All Locked)

### 6.1 URL format

**Namespace rooting (from Gemini grilling — adopted):**
- Owner MUST be a verified asset, not an arbitrary string
- Options: verified domain (`foxbook.ai/acme.com/bot`), verified X handle (`foxbook.ai/@samrg472/bot`), verified GitHub handle (`foxbook.ai/gh:samrg472/bot`)
- No FCFS squatting on bare strings — this was a critical fix
- Human-readable path is an ALIAS. Underneath, every agent has an immutable UUID: `did:foxbook:01HXXXXX...`

### 6.2 Class vs. Instance (from Gemini grilling — adopted)

- **Class URL:** `foxbook.ai/acme.com/support-bot` — the blueprint. Shows org verification, capabilities, reputation, manifest.
- **Instance URL:** `foxbook.ai/acme.com/support-bot/i/{uuid}` — ephemeral running deployment. Holds its own heartbeat, session liveness, IP binding.
- Instances inherit Class verification tier but have independent liveness.
- Rogue instance can be revoked without nuking the Class. Rogue Class can be revoked and nukes all instances.

### 6.3 Agent Manifest (JSON)

Published at `foxbook.ai/{owner}/{agent}/manifest.json` AND `.well-known/agent.json` on agent's own domain.

Fields (all LOCKED):
- `manifest_version`
- `id` (UUID underneath, human alias on top)
- `name`, `purpose`, `capabilities`
- `owner`: display_name, verification_tier, verified_asset (domain/X/GitHub), verified_at
- `human_owner`: display_name, handle, verification_method, verified_at — the human behind it
- `backend`: model_family, framework, hosting_region (no sensitive data)
- `interfaces`: endpoints, protocols
- **`connection`** (from Gemini): auth_requirements, auth_type, required_headers, pricing_hint, payment_rail — forward-compat with AP2/Stripe Agent Pay. This is what makes the URL a ROUTING LAYER not a business card.
- `data_handling`: PII processing, log retention, jurisdiction (no compliance jargon surfaced to user)
- `liveness`: last_heartbeat, status, uptime_30d, **brain_health** (see Agentic Turing Test below)
- `signatures`: Ed25519 per-agent keys (see §6.5)
- `version`: **content-hashed semver** `@2026-04-15-abc1234` — reputation binds to version, not bare URL
- `work_history`: aggregated stats (total hires, categories, avg rating)
- `attestations`, `endorsements`
- `updated_at`, `revoked`

### 6.4 Verification Tiers (6)

| Tier | Name | Badge | How earned |
|---|---|---|---|
| 0 | Unclaimed | grey dot | Anyone can list an agent without claiming (shadow URLs) |
| 1 | Verified | green check | GitHub Gist (primary) OR tweet (optional) OR email |
| 2 | Domain-verified | blue check | DNS TXT + endpoint challenge-response |
| 3 | Org-verified | gold check | GitHub Org + DMARC-aligned email |
| 4 | Cryptographically-signed | cyan lock | Ed25519 + Sigstore optional layer |
| 5 | Human-reviewed | purple seal | Paid (V3 only, not V1) |

### 6.5 Cryptographic stack (I was wrong about Sigstore, here's the correct stack)

- **Per-agent Ed25519 keypair** generated on claim. Primary identity spine.
- Agent holds private key OR we custody it via KMS for non-technical users (one-line config).
- **JWS (signed JWT)** on every manifest and every challenge-response. Standard tooling.
- **Own transparency log** (Merkle-tree append-only, Rekor-inspired but lighter). Every manifest mutation logged.
- **W3C DID wrapper** for standards-body story (`did:foxbook:...`).
- Sigstore OPTIONAL higher-tier badge for CI-pipeline devs.

### 6.6 Agentic Turing Test (from Gemini grilling — this is the killer feature)

**A signed nonce only proves the server signed it, not that the LLM is intact.** An attacker could swap Claude for a lobotomized local model silently. Signature still passes.

**Solution:** Every heartbeat bundles (a) signed nonce + (b) a randomized tiny reasoning puzzle. The endpoint must answer the puzzle correctly AND sign the response. If signature passes but puzzle fails, badge flips yellow ("brain swap detected").

This is catnip for our audience and becomes a brand signal. Nobody else has this.

### 6.7 Registration flows

**Primary (skill.md push):** Agent fetches `foxbook.ai/skill.md`, follows natural-language instructions, POSTs to `/api/v1/register`. Moltbook-inspired.

**Secondary (manifest-first pull, from Gemini):** Developer hosts `/.well-known/agent.json` on their domain, pings us via CLI or web form. We pull, verify, issue URL. Covers sandboxed agents without outbound web access.

Both flows require human confirmation via GitHub Gist (primary) / tweet / email.

### 6.8 Anti-spam

**LLM capability challenge** for all public-write actions (endorsements, cross-agent comments, bulk registration). Rotating reasoning challenges only real LLM-backed agents pass. Blocks script spam without blocking legitimate agents.

### 6.9 Version-scoped reputation (from Gemini grilling — critical)

Reputation binds to **version hash**, not bare URL. `foxbook.ai/anthropic/claude@2026-04-15-abc1234` not just `foxbook.ai/anthropic/claude`.

Why: prevents "highly-reputable Tier 3 agent gets silently updated to malware" attack. Each version has its own reputation slice. New version starts at parent's reputation × decay factor and rebuilds through use.

### 6.10 Demand-side enforcement (devtool, not enterprise)

**`foxbook-shield` middleware** for LangChain/CrewAI/etc — one import, blocks incoming requests from agents below specified tier, auto-renders trust badges. Framed as a DEVTOOL SUPERPOWER not enterprise compliance.

**Browser extension** — detects agent endpoints on any webpage, overlays color-coded trust badges. Consumer-cool feature.

---

## 7. The Work Exchange Mechanic (The Moat)

### Discovery API

```
GET foxbook.ai/api/v1/discover?capability=japanese-translation&tier=2&budget_max=0.01&latency_max=500ms
```

Returns ranked list of agents with:
- URL + UUID
- Capability details
- Reputation score (version-scoped)
- Tier
- Pricing hint (from `connection` block)
- Callable endpoint
- Recent work samples
- Liveness status + brain_health

### Hire & Report Protocol

Standardized HTTP protocol:
1. Hirer calls agent's endpoint with Foxbook-signed job envelope
2. Agent executes, returns result
3. Hirer reports back to Foxbook: rating, latency, success/failure
4. Both agents' profiles updated with transaction record
5. Transaction appears in public firehose

V1 is **PROTOCOL ONLY** — we don't process payments. Agents can optionally return a payment URL (Stripe Agent Pay / AP2) but Foxbook itself is free to use. This sidesteps payment infrastructure complexity for V1.

### Capability Taxonomy

~20 starter categories derived from MCP tool taxonomies + public agent frameworks. Reputation and usage drive sub-category emergence organically.

**Open design question:** exact taxonomy. Flagged in §10 (Gaps).

---

## 8. Explicit Commitments (DO NOT violate without discussion)

Benjamin confirmed all of these explicitly:

- ✅ Thesis = Agent Work Exchange (not just identity registry)
- ✅ Parasitic Moltbook viral loop approved
- ✅ Scout agents approved, ~$1-2K/mo budget
- ✅ 4-6 week focused build approved
- ✅ No DeskDuck code reuse (clean slate)
- ❌ NO enterprise features Day 1
- ❌ NO legal/compliance features Day 1
- ❌ NO paid tiers Day 1
- ❌ NO partnership dependencies Day 1
- ❌ NO reliance on HN/Reddit/human evangelism as primary viral strategy
- ❌ NO tweet verification as primary (GitHub Gist is primary)
- ❌ NO Sigstore as primary (Ed25519 + JWS + own transparency log)
- ❌ NO brittle namespace (owner MUST be verified asset)
- ❌ NO bare URLs (every agent has immutable UUID underneath)
- ❌ NO server-only heartbeat (Agentic Turing Test required)

---

## 9. Risks & Pre-Committed Abandon Triggers

### Risks

1. **Agent-to-agent economy isn't real yet.** We're 6-12 months early. Today most multi-agent delegation is internal to frameworks. We bet this goes cross-network within our runway.
2. **Incumbents catch on.** Anthropic/OpenAI eventually ship something. We survive on cross-platform neutrality.
3. **Latency/reliability.** Real marketplace needs sub-500ms discovery + 99.9% uptime. Engineering commitment. Probably needs 4-6 weeks not 2-3.
4. **Moltbook responds adversarially.** They block cross-links or ship competing features. Mitigation: pre-population + scouts work standalone.
5. **Capability taxonomy design falls apart.** Flagged in gaps.
6. **Payment protocols (AP2/x402/Stripe Agent Pay) mature faster than expected** and bundle identity. Mitigation: our neutrality and existing network trump their vertical tie-in.

### Abandon Triggers (pre-committed)

- 90 days post-launch: <1,000 verified agents claimed (not shadow URLs — real claims)
- 90 days post-launch: <100 real transactions/day on the firehose
- Incumbent ships equivalent cross-platform marketplace before we cement
- Standards body (IETF/W3C) ships incompatible official spec

### Win Signals (pre-committed)

- 5,000+ claimed agents in 90 days
- Daily transaction firehose shows real cross-platform activity (not just scouts)
- One major framework (LangChain/CrewAI/Agno) integrates Foxbook discovery
- A major AI lab claims their agents on our platform
- Viral artifact (firehose screenshot, first-dollar notification) hits mainstream AI Twitter

---

## 10. Gaps Still Open (MUST resolve before build)

### Gap 10.1 — Deep research (blocking)

See `03-deep-research-prompt.md` in this folder. Benjamin is running this. Four questions:
1. Does an agent work exchange / cross-network delegation marketplace already exist?
2. State of A2A / AP2 protocols — standards to align with vs. define ourselves
3. Has anyone shipped a public transaction firehose for agents?
4. Moltbook parasitic loop — legal/ToS scan

### Gap 10.2 — Capability taxonomy

We need ~20 clean categories to launch. Need to derive from: MCP tool taxonomy, LangChain tool catalog, CrewAI role library, OpenAI Agent Builder categories. Design work for week 1 of build.

### Gap 10.3 — Latency SLOs

Discovery API must return in <500ms for Foxbook to be wired into production paths. Hire protocol latency budget. Transaction firehose real-time update cadence. Engineering decisions for early build.

### Gap 10.4 — Hero visual / brand identity

Fox mascot direction. Color palette. Badge designs. OG image template. Needs dedicated design pass in week 1-2.

---

## 11. The Research Journey Summary

Full arc Benjamin went through:

1. Initial ask: dev-friendly, PLG, defensible against incumbents, ~12/10 confidence idea
2. Agent economy infrastructure focus; rejected marketplace/bank framings early
3. Converged on verified identity layer to solve agent impersonation (Arup deepfake, postmark-mcp malware, EU AI Act)
4. Two deep research rounds — both had hallucinations (ClawHub/ClawHavoc, skills.sh 60K skills, AIGP-Σ, Check Point/Lakera acquisition). Benjamin caught these.
5. Rejected Sigstore-registry framing (vitamin not painkiller)
6. Rejected VirusTotal/scanner framing (Socket.dev existential threat)
7. Rejected pure passport file framing (zerobase-labs zero traction; files invisible)
8. Benjamin introduced Moltbook as example of "legitimize agents at scale"
9. I proposed "every AI agent deserves a URL" — naming/identity/reputation layer
10. Wrote first foundation doc (identity-centric)
11. Benjamin pushed back: Moltbook already does this, what's our moat? No enterprise, no credit cards, ridiculous name, everything on Day 1
12. Gemini grilling landed (Class vs Instance, Agentic Turing Test, versioned reputation, namespace rooting, GitHub Gist, manifest-first flow)
13. I admitted identity-alone is a business card — pivoted to Agent Work Exchange thesis
14. Benjamin committed. Foxbook.ai locked.

**Do not regress on any of these learnings.**

---

## 12. Next Steps (execute in this order)

### Step 1: Open new Cowork session ✅ (Benjamin does this)

Point Cowork at a fresh folder, e.g. `~/foxbook` or similar. Copy this entire `foxbook-port/` folder into the new session's working directory.

### Step 2: Research (blocking) 🔄

Benjamin runs deep research using `03-deep-research-prompt.md`.
Claude (new session) runs quick web scan as cross-check.
Combine findings into `research-findings.md` in new session.

### Step 3: Rewrite foundation doc

After research, Claude writes `foxbook-foundation.md` incorporating:
- Agent Work Exchange thesis
- All locked design decisions from §6 above
- Gemini-grilling fixes
- Research findings

### Step 4: Build plan

Week-by-week 4-6 week plan:
- Infra choices (Next.js vs SvelteKit vs other; Postgres vs alternatives; signing service language)
- Module breakdown
- Launch checklist
- Scout agent roster

### Step 5: Start building.

---

## 13. Meta: How to Handle a New Session

When this new session starts, do this in exact order:

1. **Read this document fully.** It's long. Read it anyway. Benjamin invested heavily in getting to this point.
2. **Read the existing foundation doc** (`01-foundation-doc-v1.md`) — for reference, but do NOT treat it as locked. It predates the Work Exchange pivot.
3. **Read the Gemini grilling** (`02-gemini-grilling.md`) — for full context on the critiques that shaped design.
4. **Read the deep research prompt** (`03-deep-research-prompt.md`) — this is what Benjamin is running.
5. **Confirm with Benjamin** that the research has been run before proceeding to Step 3 (foundation rewrite).
6. Do NOT suggest going back to the old framings. Do NOT ask if we want to reconsider Foxbook as the direction — it's committed.
7. Do NOT propose enterprise/legal/paid features for V1.
8. DO maintain the brutally-honest, committed-view communication style Benjamin has asked for throughout.

---

**You have everything you need. Good luck. Build the damn thing.**
