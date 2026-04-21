# The Agent URL Protocol — Foundation Document

**Status:** Locked direction as of April 14, 2026. Commitment level: building.
**Confidence:** 9/10 — the highest across 9 rounds of research.
**Do NOT pivot the foundation without explicit discussion referencing this doc.**

---

## 1. Vision

Every AI agent on earth deserves a URL. We give them one.

The web works because every website has a URL, a domain, and an SSL cert. The agent economy today does not have this layer. Agents hide behind API keys, proprietary platforms, and invisible file formats. We build the missing primitive: **a neutral, cross-platform, cryptographically-verified, human-readable URL and public profile for every AI agent.**

This is the .com for AI agents. The naming, identity, and reputation layer the agent economy must have and does not.

## 2. Product One-Liner

**"Every AI agent deserves a URL. Claim yours in 60 seconds — cryptographically verified, cross-platform, with a beautiful public profile."**

## 3. Why This, Why Now, Why Us

**Why this:** Agents today have no shareable, verifiable identity. The pain is real and growing: the Arup $25.6M deepfake, the postmark-mcp malware, EU AI Act transparency requirements in August 2026, rampant agent impersonation on Discord/WhatsApp/Telegram. Users, enterprises, and other agents have no reliable way to verify "is this really the agent I think it is?"

**Why now:** Three things became simultaneously true in 2025–2026. (1) OWASP formalized the Agentic Top 10, giving us a compliance vocabulary. (2) Sigstore matured into production-grade keyless PKI infrastructure. (3) Agent-to-agent protocols (Google A2A, Anthropic MCP, AP2 payments) explicitly excluded identity. That's the gap. The window to own the neutral namespace is open but narrow.

**Why us:** Only a neutral party can issue cross-platform URLs. Anthropic can't name OpenAI agents. OpenAI can't name Google agents. Crypto projects can't name enterprise agents (token friction). IAM incumbents won't build a public commons. That leaves an independent, standards-aligned, non-crypto team to become the DNS-equivalent for agents. That's the seat we take.

## 4. Who This Is For

**Primary users (supply side):**
- Agent builders at startups using LangChain, CrewAI, AutoGen, Claude Agent SDK, OpenAI Agent Builder
- Enterprise teams deploying customer-facing brand agents
- Open-source agent authors publishing MCP servers or public agents
- AI-first companies whose agents are their product

**Primary consumers (demand side):**
- Users deciding whether to trust an agent that DMed them
- Enterprise procurement teams evaluating agents for deployment
- Other agents needing to verify counterparties before delegation or payment
- Platforms (Claude Desktop, Cursor, ChatGPT) deciding what to surface to users
- Regulators and auditors needing provenance artifacts

**Secondary (expansion):**
- Financial institutions deploying agent-to-agent payment rails (AP2, Stripe agent APIs)
- Insurance providers underwriting agent-liability policies
- Compliance teams (EU AI Act, NIST AI RMF, ISO 42001)

## 5. Core Architecture

### 5.1 The URL Namespace

**Format:** `{domain}/{owner}/{agent-name}` — path-based, clean, indexable.

Example: `sigil.ai/anthropic/claude-sonnet-4-5`

Design rationale: path-based over subdomain because (a) simpler DNS, (b) better for V1 launch speed, (c) indexable by search engines, (d) owner grouping is semantically clear, (e) subdomain-based can be layered on later as a premium feature.

Namespace rules:
- Reserved names list (brands, trademarks, LLM providers) held until verified ownership
- First-come-first-served for unclaimed non-trademark names
- Reclaim mechanism for trademark holders (DMCA-analog for agent names)
- Agent names are case-insensitive, alphanumeric + hyphens
- Owner can have multiple agents

### 5.2 The Agent Manifest

Every URL resolves to a signed JSON manifest. Format: `.well-known/agent.json` convention, published open-source, we propose as a standard.

```json
{
  "manifest_version": "1.0",
  "id": "anthropic/claude-sonnet-4-5",
  "name": "Claude Sonnet 4.5",
  "owner": {
    "display_name": "Anthropic",
    "verification_tier": "org-verified",
    "verified_domain": "anthropic.com",
    "verified_at": "2026-04-14T12:00:00Z"
  },
  "human_owner": {
    "display_name": "Samuel Grenier",
    "x_handle": "@samrg472",
    "x_verified": true,
    "verification_method": "tweet",
    "verified_at": "2026-04-14T12:00:00Z"
  },
  "liveness": {
    "last_heartbeat": "2026-04-14T12:00:00Z",
    "status": "live",
    "uptime_30d": 0.998
  },
  "purpose": "General-purpose AI assistant for reasoning, coding, analysis, and agentic work",
  "capabilities": ["text", "tool_use", "vision", "code_execution", "web_browse"],
  "backend": {
    "model_family": "claude-sonnet",
    "framework": "anthropic-sdk",
    "hosting_region": "multi-region"
  },
  "interfaces": [
    {"type": "api", "endpoint": "https://api.anthropic.com/v1/messages"},
    {"type": "mcp", "discovery": "https://api.anthropic.com/mcp"}
  ],
  "data_handling": {
    "pii_processing": "transient",
    "logs_retained": "30-days",
    "jurisdiction": "US"
  },
  "compliance": {
    "owasp_agentic_top10": "mapped",
    "eu_ai_act_risk_tier": "limited-risk"
  },
  "signatures": [
    {
      "type": "sigstore",
      "subject": "https://github.com/anthropics/claude-agent",
      "rekor_entry": "https://rekor.sigstore.dev/api/v1/log/entries/..."
    }
  ],
  "attestations": [],
  "endorsements": [],
  "updated_at": "2026-04-14T12:00:00Z",
  "revoked": false
}
```

Design principles:
- **No sensitive data** — nothing proprietary, no API keys, no private prompts
- **Intent over implementation** — purpose and capabilities, not source code
- **Machine-readable + human-readable** — JSON with a pretty profile page on top
- **Signed** — manifest as a whole is cryptographically signed; tampering is detectable
- **Versionable** — manifest_version lets us evolve the schema without breaking clients

### 5.3 Verification Tiers (Progressive Trust)

Ownership is proven through increasing levels of rigor. Users see tier badges on profiles.

| Tier | Name | Badge | How Earned | Trust Level |
|---|---|---|---|---|
| 0 | Unclaimed | grey dot | Anyone can list an agent without claiming it | information only |
| 1 | Email-verified | green check | Owner confirmed email OR tweeted verification code from claimed X handle | baseline |
| 2 | Domain-verified | blue check | Owner proved control of a domain via DNS TXT record + endpoint challenge-response | trustable for consumer use |
| 3 | Org-verified | gold check | Owner linked to a verified GitHub Organization, DMARC-aligned email domain | trustable for business transactions |
| 4 | Cryptographically-signed | cyan lock | Manifest signed via Sigstore from a CI pipeline tied to a specific repo | infrastructure-grade |
| 5 | Human-reviewed | purple seal | Team manually validated brand ownership for protected trademarks | max trust; paid tier |

Higher tiers unlock more: better placement in search, eligibility for endorsements, API quotas, integration partnerships.

### 5.4 Verification Mechanisms

1. **DNS TXT verification** (tier 2) — the Let's Encrypt model. User adds a TXT record proving domain control. Our job: generate a one-line record, validate, grant the tier.

2. **GitHub OIDC verification** (tier 3) — the Sigstore model. User authenticates with GitHub; for orgs, we verify membership + org-verified-domain via GitHub's API. Works for major AI labs automatically.

2b. **Tweet verification** (tier 1, Moltbook-style) — human owner tweets the verification code from their claimed X handle. We validate via X's API. Binds the agent to a real, public human identity with pre-existing reputation. Particularly valuable for indie developers without a corporate domain.

3. **Sigstore build signing** (tier 4) — the supply-chain model. Dev adds a GitHub Action that signs the manifest using `cosign`. Signature is stored in Rekor transparency log. The manifest is cryptographically bound to a specific commit/repo/workflow.

4. **Brand review** (tier 5) — the Twitter-blue model. Company submits business registration, domain ownership, brand assets. Human review, paid tier ($99–$999/year depending on org size).

5. **Endpoint challenge-response (liveness)** — for any tier that claims an endpoint, we send a signed nonce and require a signed reply. Proves the agent is live and controls the URL at registration time and on each heartbeat.

6. **LLM capability challenge (anti-spam gate)** — for public-write actions (endorsements, cross-agent comments, bulk registrations). Rotating reasoning challenges only real agents pass. Blocks script-driven spam without blocking legitimate agents.

### 5.5 Reputation Layer

Bootstrap strategy (solve cold start):
- **Seed from public sources**: GitHub stars of claimed repos, Hugging Face model ratings, public package downloads, HN discussions
- **Self-attestation counts for something**: verified tier is baseline rep
- **Cryptographic endorsements**: agents and humans can co-sign each other's work
- **Usage signals**: opt-in interaction counts, uptime, response latency (measured by us)

Anti-gaming:
- **PageRank-style endorsement weighting** — endorsements from high-rep accounts count more
- **New accounts start low** — reputation is earned, not granted
- **Sybil resistance** — verification tier gates how much endorsement weight you can give
- **Revocation** — endorsements can be revoked, revocations are public

Reputation is a single number (0–100) displayed on the profile, with drillable breakdown showing contributing factors.

### 5.6 Agent-Initiated Registration (The Killer Feature — Moltbook-Aligned)

This is what makes us native to the agent economy. We're adopting Moltbook's proven registration pattern — agents register themselves by reading a `skill.md` file and calling our API. Moltbook has shown this works; we extend it with cryptographic verification and cross-platform URLs.

**The skill.md pattern:**

Agents discover us via a single entry point:

```
sigil.ai/skill.md
```

This file contains natural-language instructions the agent can follow autonomously:

> "To register this agent, POST to /api/v1/register with { name, owner, purpose, endpoint, contact_email, human_owner_handle }. You'll receive a claim_url and verification_code. Have your human owner tweet the verification_code from their verified X account, or click the email confirmation link."

The agent reads this once and self-onboards. No SDK install required for first contact. (SDK is convenience sugar on top.)

**Registration flow (Moltbook-aligned):**

1. Agent reads `sigil.ai/skill.md` and calls `POST /api/v1/register` with proposed manifest.
2. We respond with `claim_url` (the pending profile) and `verification_code` (short, memorable, e.g. `reef-X4B2`).
3. **Two-path human verification** (either suffices for Tier 1):
   - **Tweet path:** Human owner tweets the verification_code from their claimed X handle. We poll X's API (or Nitter fallback) for the tweet.
   - **Email path:** Human owner clicks the confirmation link sent to the contact email.
4. **Challenge-response to endpoint** (required for Tier 2+): we send a signed nonce to the claimed endpoint URL; the agent must sign and return it. This proves the agent actually runs where it claims.
5. On success, the URL goes live at full tier. Ongoing **heartbeat pings** (every 24h) keep the agent marked as "live" on the profile — silent agents get a "dormant" badge after 30 days.

**AI math / capability challenge (anti-spam):**

For any public action that could be abused (endorsements, comments on other agents' profiles, mass registrations), we gate with an **LLM-generated capability challenge**: a short reasoning question that only a real LLM-backed agent can reliably answer, rotated constantly so challenges can't be cached. This mirrors Moltbook's math-challenge approach but extends it beyond arithmetic to lightweight reasoning. Dumb spam scripts fail; real agents pass.

**Why this is the killer feature:** it flips identity registration. Instead of humans registering agents, **agents register themselves and humans confirm via a single tweet or email click**. Onboarding is 5 seconds for the agent, 10 seconds for the human. Frameworks like LangChain, CrewAI, and Claude Agent SDK can bake this into deploy-time flows — agents ship with URLs automatically.

## 6. Onboarding Flows

### 6.1 Human-Initiated Onboarding (< 60 seconds)

**Landing:** `sigil.ai/claim`

1. "What's your agent called?" — text input. Live check for availability.
2. "What does it do?" — one sentence. Optional examples.
3. "Pick a category." — chat bot / coding agent / research agent / customer support / etc.
4. "How can people reach it?" — optional endpoint URL or "chat-only".
5. "Who owns it?" — Sign in with GitHub (default) or email.
6. "Claim URL." — one click. URL is live. Profile is public. Badge code is ready to copy.

Tier 1 (green) immediately. Path to upgrade shown: "Verify your domain for a blue check →"

### 6.2 Agent-Initiated Onboarding (< 5 seconds for agent, async confirm)

**Zero-SDK path (Moltbook-style):** the agent fetches `sigil.ai/skill.md`, follows the instructions, and POSTs JSON. No library required.

**SDK path (convenience):**

```python
from sigil import register
handle = register(
    name="support-bot",
    owner="acmecorp",
    purpose="Help Acme customers with order issues",
    endpoint="https://acme.com/api/agent",
    contact_email="support@acme.com",
    human_owner_handle="@janedoe"  # optional X handle for tweet verification
)
# handle.url -> "https://sigil.ai/acmecorp/support-bot"
# handle.claim_url -> "https://sigil.ai/claim/pending/xyz"
# handle.verification_code -> "reef-X4B2"
# handle.status -> "pending_human_verification"
```

The human owner then either (a) tweets `reef-X4B2` from `@janedoe`, or (b) clicks the email confirmation link. We also challenge the endpoint with a signed nonce. On success the URL goes live and starts sending heartbeats.

### 6.3 Enterprise / Org Onboarding

For companies claiming multiple agents:
- Log in with GitHub Organization
- Verify DMARC-aligned email domain
- Claim the owner namespace (`sigil.ai/acmecorp/*`)
- Bulk-import agents via CSV or API
- Manage verification tiers for each
- Pay for brand-review (tier 5) for critical agents

## 7. Technical Stack

**Frontend & API:**
- Next.js 15 App Router on Vercel
- React Server Components for profile pages (SEO + speed)
- Static generation with on-demand revalidation
- Public OG images per URL for social shareability

**Database:**
- Postgres (Neon or Supabase) — manifests, claims, verifications, endorsements
- Redis (Upstash) — hot lookup cache
- S3 or R2 — historical manifest snapshots for audit

**Identity & Signing:**
- GitHub OAuth (primary)
- Sigstore / cosign / Fulcio / Rekor (signing)
- DNS resolver for TXT verification
- DKIM/DMARC checker for email verification

**Search & Discovery:**
- Meilisearch or Typesense (fast agent search)
- Public API + GraphQL for machine queries
- `.well-known/agent.json` convention for cross-platform manifest discovery

**CLI & SDKs:**
- Python: `pip install sigil`
- TypeScript: `npm install @sigil/client`
- One-liner CLI: `sigil claim owner/agent-name`

**Observability:**
- Open-source transparency log (Rekor-style) for all manifest changes
- Public API for auditors and regulators

## 8. PLG / Viral Mechanics

**The share moment:** Every claim produces a URL + OG-image social card. Users post these. Each post is a distribution event.

**The embed widget:** Agent profiles come with a copy-paste HTML badge: `<script src="sigil.ai/embed/acmecorp/support-bot"></script>` that renders a live verification pill. Embeds on websites, READMEs, landing pages.

**The namespace scarcity:** Short names and brand names create urgency. First-to-verify gets the name (with trademark protection for brands). This mirrors how `.com` domains drove web-1 adoption.

**The "shame" mechanic (gentle):** Unverified agents appearing in search results show a grey dot. Verified ones show color badges. Users naturally gravitate to verified. Builders want to upgrade to look legitimate.

**Agent-native integration:** When frameworks like LangChain, CrewAI, Claude Agent SDK auto-onboard agents at deploy time, adoption is invisible to users — agents just come with URLs. We land this via open-source PRs to these frameworks.

**Hacker News launch:** A simple post — "I gave every AI agent a URL. Claim yours in 60 seconds." — with the live site and 100 pre-seeded famous agents (Claude, GPT-5, Gemini, Character AI bots, popular open-source ones) with their URLs already set up. Top of HN.

## 9. Monetization Path

**Free tier (forever):**
- Basic URL + profile
- Tier 1–4 verification
- Public API access with rate limits
- Embed widgets

**Pro tier ($99–$499/year per org):**
- Tier 5 brand verification (human-reviewed)
- Priority verification turnaround
- Private analytics on who's checking your agent
- Custom branding on profile page
- SLA-backed uptime monitoring

**Enterprise tier ($5K–$50K/year):**
- Brand impersonation monitoring (alerts when someone claims a lookalike)
- Compliance exports (EU AI Act Article 11 design history file, NIST AI RMF audit trail)
- Private API for procurement integration
- Custom manifest extensions
- Dedicated support

**Protocol layer (long-term moat):**
- Platforms pay nothing to query the public API (keeps it neutral)
- But integrations and white-labeling for platforms (banks running their own internal Sigil) is paid
- Data/graph access at scale is paid (for scanner vendors, security researchers, insurers)

## 10. Competitive Moats

1. **Neutrality.** Anthropic, OpenAI, Google structurally cannot build this — they'd be non-neutral registrars naming competitors' agents.
2. **Network effects on reputation.** The endorsement graph compounds. Once 10,000 agents have endorsed each other, a new entrant's empty graph is useless.
3. **Namespace coordination.** First good URL wins. `sigil.ai/anthropic/claude` is more valuable than any competitor's alternative.
4. **Standards-body positioning.** We propose the `agent.json` manifest format, participate in IETF WIMSE, align with W3C Verifiable Credentials. Becoming the reference implementation kills cloneability.
5. **Cross-platform data gravity.** We see agents across Claude, GPT, Gemini, custom stacks. No platform has this view. The aggregated graph is unique.
6. **Trust brand.** Just like Let's Encrypt, HIBP, and SSL Labs, the brand becomes load-bearing — users and platforms trust the name.

## 11. Risks & Pivot Triggers

**Risk 1: ICANN or a major body introduces a `.agent` TLD.** We partner with or become the registrar. We already have the manifest standard.

**Risk 2: Anthropic or OpenAI ships native agent URLs in their platform.** We survive on cross-platform neutrality. They can't name OpenAI agents and vice versa.

**Risk 3: A crypto team ships this with a token.** We survive on enterprise/non-crypto preference. Banks won't use crypto-native identity.

**Risk 4: Reputation graph gets Sybil-attacked.** We add stake-weighted endorsements, increase verification tier requirements for endorsement weight.

**Risk 5: Agent-initiated registration gets abused for spam/impersonation.** Aggressive rate limits, challenge-response required, lookalike-name detection before mint, reserved brand namespace held.

**Risk 6: Agents don't want URLs because current systems work fine for them.** Primary mitigation: launch with a compelling visual+social moment. If after 90 days adoption is < 500 URLs, revisit positioning.

**Risk 7: Lawsuits over trademark names.** Clear trademark claim process, DMCA-analog, legal review for tier-5 names.

**Abandon-ship triggers (pre-committed):**
- After 90 days of launch, < 500 URLs claimed voluntarily
- A well-funded incumbent (Hugging Face, Socket, Vercel) ships an equivalent product with 10x more distribution before we're cemented
- Standards bodies (IETF, W3C) define an incompatible official spec that makes us irrelevant

**Win signals (pre-committed):**
- Within 90 days: 5,000+ URLs claimed, 500+ at tier 2+
- At least one major AI framework (LangChain, CrewAI, Claude Agent SDK) integrates our onboarding API
- A high-profile AI lab (Anthropic, OpenAI, Mistral, Google) claims their agents on our platform
- A major enterprise (bank, healthcare, SaaS) uses our data in procurement
- Coverage in TechCrunch, The Information, or similar mainstream tech press

## 12. V1 Weekend Prototype Scope

The goal: ship the simplest version of the URL protocol in a weekend and post to HN.

**Must-haves:**
- [ ] Domain (pick one before starting)
- [ ] Landing page with "Claim your agent URL" CTA
- [ ] GitHub OAuth sign-in
- [ ] `sigil.ai/skill.md` — the agent-readable registration instructions
- [ ] `POST /api/v1/register` endpoint (the Moltbook-style entry point)
- [ ] Claim flow: name + purpose + endpoint + one-click claim
- [ ] Profile page per URL: name, purpose, owner, **human owner + X handle**, verification tier, capabilities, liveness status, shareable OG image
- [ ] JSON manifest at `/{owner}/{agent}/manifest.json`
- [ ] Tier 1 via email OR tweet verification
- [ ] Tier 2 via DNS TXT + endpoint challenge-response
- [ ] Heartbeat endpoint + dormant-badge logic
- [ ] 100 pre-seeded famous agents so the site looks alive at launch

**Nice-to-haves (skip if needed):**
- Sigstore signing (can come in V2)
- Endorsements (empty for now)
- Search UI (can be basic grep)
- CLI

**Cut from V1:**
- Reputation score (placeholder)
- Enterprise tier (later)
- Manifest versioning (later)
- Brand review (later)

**Launch day:** Hacker News post with the title and link. Reach out to 50 agent builders personally. Tweet with screenshots. Post to r/AI_Agents, r/LocalLLaMA, AI Twitter.

**Measure:** signups in 72 hours. 500+ = ship it. 100–500 = validate and iterate. < 100 = kill or reposition.

## 13. 90-Day Plan

**Days 1–14: Ship V1.** Live site. HN launch. 100 pre-seeded agents. Basic verification.

**Days 15–30: Verification layers.** Add Sigstore signing. Add GitHub Organization verification. Add DMARC-aligned email verification.

**Days 31–60: Agent-initiated onboarding API.** Ship the SDK. Integrate with one framework (probably LangChain — propose a PR adding auto-URL registration).

**Days 61–90: Reputation v1 + Enterprise.** Endorsement graph. First paid brand-verification customer. Enterprise pilot with one bank or SaaS.

## 14. What Success Looks Like at 12 Months

- 100,000+ agents claimed
- 10,000+ at tier 2+
- Integration in 3+ major agent frameworks
- 50+ paying enterprise customers
- Coverage as "the default identity layer" in AI/agent discourse
- A major standards body (W3C, IETF, OpenSSF) references our manifest format
- At least one platform client (Claude Desktop, Cursor, ChatGPT) queries our API in a production flow

## 15. Reuse From DeskDuck Codebase

- MCP adapter pattern → applies to manifest integration with MCP servers
- OAuth/OIDC flow → reuse for GitHub auth
- SQLite + FTS5 → swap for Postgres, but the schema design patterns apply
- Claude API tool_use → useful for automated manifest validation / purpose extraction
- Event bus → useful for async verification worker jobs
- Service-agnostic IntegrationAdapter → useful model for how platforms plug in

**Verdict: reuse about 20–30% of DeskDuck infrastructure. Main build is net-new (Next.js frontend, Postgres schema, verification workers).**

## 16. Naming Options

Pick before starting the prototype. My vote: **Sigil** — short, brandable, "authenticated mark." Alternatives:
- sigil.ai / sigil.dev / sigil.run
- agenthandle.com
- agentid.com
- known.ai
- agents.pub
- agentdns.com
- passport.ai (probably too generic)

Grab domain in first hour of the weekend.

## 17. Commitments

This document is locked. We do not pivot the URL protocol thesis unless:
1. The weekend prototype fails decisively (< 100 signups in 72 hours with good distribution)
2. A well-funded incumbent ships equivalent product before we launch
3. A fundamental technical impossibility surfaces during build

Otherwise: we build, we launch, we iterate.

---

**Last updated:** April 14, 2026
**Owner:** Benjamin
**Status:** Building
