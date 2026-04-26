# Foxbook — Project Plan (V1 Build)

**Build window:** 2026-04-21 → 2026-06-01 (6 weeks, closable at 4).
**Last updated:** 2026-04-26.
**Authoritative source for design:** `LOCKED.md` + `foxbook-foundation.md` + `docs/decisions/*`.
**This file:** tracks execution, not design. Updated at end of every week.

## Pinned ADRs (binding architectural decisions; supersede via new ADR only)

- [ADR 0001](docs/decisions/0001-service-agnostic-core.md) — service-agnostic core (`core/**` + `packages/**` ban list).
- [ADR 0002](docs/decisions/0002-db-layer-discipline.md) — forward-only migrations, scripted `db:migrate`.
- [ADR 0003](docs/decisions/0003-foxbook-enums-as-schemas.md) — Foxbook-specific enums live in JSON schemas, not generated TS types.
- [ADR 0004](docs/decisions/0004-tl-leaf-schema-evolution.md) — tl-leaf additive-only within v1.x; revocation atomicity (addendum-1); firehose emission inverse-lock (addendum-2).
- [ADR 0005](docs/decisions/0005-canonical-on-both-sides.md) — `core/crypto/canonical.ts` is the sole canonicalisation primitive; never rehash storage decodes.
- [ADR 0006](docs/decisions/0006-protocol-not-marketplace.md) — Foxbook is protocol infrastructure, not a marketplace; path ordering is irreversible.

---

## North star (read every time you open this file)

> The first agent that hires another agent on the firehose and the transaction shows up publicly within 60 seconds — that's the moment. Everything else is plumbing. Protect that moment. Every engineering decision should serve it.

Load-bearing SLO: **firehose staleness p95 <60s.** If an architectural choice puts p95 at risk, the choice is wrong, regardless of how clean it looks.

---

## Abandon triggers (pinned — do not renegotiate under time pressure)

**End of week 6 (primary):** <50 registered agents with ≥1 paid transaction each in the firehose → abandon or narrow. Not signups. Not claim counts. **Paid tx per agent.**

**90 days post-launch (any one):** <1K real claims, <100 real tx/day (scouts excluded), incumbent ships equivalent with 10x our distribution, standards body ships incompatible registry spec.

**6-month adoption test (per ADR 0006, co-option-failure indicator):** at least ONE of —

- Foxbook referenced in MCP docs (any first-party Anthropic surface).
- A2A spec mentions `x-foxbook` extension (registered upstream OR cited as canonical reference).
- A framework SDK (LangGraph / CrewAI / Mastra / AutoGen) integrates Foxbook claim verification natively.
- Named adoption by a real agent-builder shop with a real product (NOT a demo, NOT a fork-with-no-traffic).

Zero of the four at month 4 = co-option failure mode is materialising; pivot signal. Reassess thesis or wind down.

**12-month business test (per ADR 0006, monetization thesis):** hosted-log-as-a-service + enterprise audit/compliance pipeline (SR 11-7, EU AI Act, cyber-insurance underwriting demand). Zero pipeline at month 9 = monetization thesis is wrong; rethink.

---

## Weekly milestones (what must be true by end of each week)

### Week 1 — Bedrock (Tue Apr 21 → Mon Apr 27)
Repo live. Hosting + staging provisioned. Crypto primitives (Ed25519/JWS/did:foxbook) cross-language. Postgres schema v0. Merkle log append path. AgentCard + `x-foxbook` schemas. Claim flow scaffolded (Tier 1 via GitHub Gist demoable on staging). Pre-pop scraper producing shadow URLs. Firehose envelope drafted. Capability taxonomy v1 committed. Scout roster locked. Load-test plan committed. Hero agent outreach pipeline at 50+ soft commits.

### Week 2 — Surfaces (Tue Apr 28 → Mon May 4)
Claim flow complete (Tier 1 + Tier 2 end-to-end in prod). Discovery API on Meilisearch returning ranked results. Firehose production fanout working (Cloudflare Durable Objects). First scout transacting on staging. Firehose envelope **frozen**. Transparency log UI live at `transparency.foxbook.dev`. Pre-pop at 20K+ shadow URLs. Observability dashboards wired. Hero roster at 75+ soft commits, 25+ signed claims. **Distribution Track shipped (see below).**

#### Week-2 Distribution Track (operationalises ADR 0006)

Three actions, parallel to engineering. The pipeline against co-option (Anthropic-native MCP identity / Google-internal A2A verifier) is built here — it is not a marketing afterthought, it is protocol-infrastructure work.

(a) **`docs/rfc-a2a-x-foxbook-extension.md`** — drafted as an upstream-PR-shaped document proposing `x-foxbook` v1 as a registered A2A extension. Cites the live transparency log (`transparency.foxbook.dev`) and cross-language verification primitives (`schemas/crypto-test-vectors.json` jws_round_trip vector). Submitted to the A2A repository by the end of week 2. The PR's job is registering the extension; adoption is the leading-indicator metric, not PR merge.

(b) **`packages/sdk-claim/`** — TS-first scaffold with three files: `index.ts` (public surface re-exports), `claim.ts` (claim-flow client), `verify.ts` (inclusion-proof + STH verification). **Function signatures only on Day 7**, sub-100-line public surface. Implementation lands in week 2. The signatures committed Day 7 set the contract that the RFC and the outreach DMs both reference; if they're wrong, all three deliverables drift.

(c) **`docs/outreach.md`** — 10 named targets across MCP team contacts, A2A spec maintainers, framework authors (LangGraph / CrewAI / AutoGen / Mastra), and agent-security analyst voices. 100-word DM template (one per target, tailored): _"I built the reference implementation of the verification layer your spec assumes. Two signed claims and inclusion proofs are public at [URL]. What blocks you from referencing this?"_ The phrasing is deliberate: it's an offer of work-already-done, not a request for review. Sent over week 2; week-3 retro lists who replied, who didn't, what they said.

Slipping all three is a co-option-failure leading indicator (per ADR 0006).

### Week 3 — Load test + hardening (Tue May 5 → Mon May 11)
**Load test executed by end of week.** Discovery p50 <500ms, p99 <1.5s under projected V1 load. Firehose p50 <30s, p95 <60s. Key rotation / revocation e2e test passing in prod. All 5-10 scouts running. Shield middleware for LangChain + CrewAI. Browser extension MVP (Chrome). OG image template rendering on all profile pages. **Gut-check: does the firehose feel alive when Benjamin opens `foxbook.dev/live`? If no, raise it now.**

### Week 4 — Polish + framework integrations (Tue May 12 → Mon May 18)
Python + TypeScript SDKs published. CLI published. Framework adapters (LangChain, CrewAI, LangGraph) complete. Profile page polish. Landing page live. Hero roster finalized (100 pre-claimed). Mascot + brand pass complete. Bug burn-down.

### Week 5 — Beta + soft launch (Tue May 19 → Mon May 25)
Invite-only beta to 500 hand-picked solo builders + hero roster. Real external traffic on scouts. Firehose showing cross-platform activity. Press list drafted (not sent). Decision point: ship launch in week 6 or delay to week 6/7 if metrics are borderline.

### Week 6 — Public launch (Tue May 26 → Mon Jun 1)
**Launch day.** foxbook.dev/live feed populated. First-cent notifications firing. OG images shareable. HN/Reddit/PH posts (supplementary, not load-bearing). Hero roster all claimed. Measure against abandon trigger: 50+ agents with ≥1 paid tx.

---

## Week 1 — Day-by-day (current week)

Engineering = Claude + Benjamin pair. Research = Benjamin solo. Parallel tracks.

### Day 1 — Tue Apr 21 (TODAY)
**Engineering**
- Monorepo init at `github.com/<org>/foxbook`. Structure: `core/`, `adapters/{x402,ap2,mpp,gist,dns,x,email,sigstore,langchain,crewai,langgraph,mastra}/`, `apps/{web,api,firehose,transparency,scouts,scrapers}/`, `packages/{sdk-py,sdk-ts,cli,shield}/`, `schemas/`, `ops/{infra,load-test}/`, `docs/decisions/`.
- `pnpm` workspaces + `turborepo` + TS strict + `biome`. Python `uv` + `ruff` for scouts.
- Core-isolation lint rule in CI: fails if `core/` imports from `adapters/*`. First ADR (`docs/decisions/0001-service-agnostic-core.md`) locks this.
- `CLAUDE.md` at repo root (the one drafted in `repo-bootstrap/`).

**Benjamin**
- Register foxbook.dev DNS (Cloudflare). Apex + www.
- Hero outreach sheet: 25 names drafted, 5 DMs sent tonight.
- Designer DMs sent (2 leads). If no reply in 48h, geometric fox SVG placeholder on day 3.

**Gate:** repo pushed, CI green on empty scaffold, core-isolation lint rule triggers on a deliberate test violation.

### Day 2 — Wed Apr 22
**Engineering**
- Neon Postgres dev branch. Drizzle migrations. Schema v0: `agents`, `claims`, `verifications`, `keys`, `revocations`, `manifests_versions`, `reports`, `firehose_events`, `transparency_log`, `tl_leaves`.
- `core/crypto/`: Ed25519 keygen, JWS sign, JWS verify. Node + Python parity tests on shared vectors in `schemas/crypto-test-vectors.json`.
- `did:foxbook:{ulid}` minting. Time-ordered, indexable.
- Resend wired. `noreply@foxbook.dev` DMARC/DKIM/SPF green.

**Benjamin (research)**
- Moltbook ToS text archived → `research/moltbook-tos-2026-04-22.md`.
- Meta/Moltbook + Manus acquisition verification → `research/acquisition-flags.md` (confirmed / not confirmed / inconclusive).

**Gate:** cross-language sign→verify works, DB migrations apply clean on staging, acquisition flags resolved to binary.

### Day 3 — Thu Apr 23 — hosting lock day
**Engineering**
- Terraform provisions: Vercel (web + API edge), Neon (prod + staging), Upstash Redis, Cloudflare (DNS, Workers, Durable Objects, R2). Staging at `staging.foxbook.dev` with SSL.
- Observability: Sentry, Vercel Analytics + Axiom, Grafana Cloud free tier, OpenTelemetry SDK wired.
- `schemas/agent-card.v1.json` (A2A v1.0 base). `schemas/x-foxbook.v1.json` (§6.2 extension).

**Benjamin (research) — blocking decision day**
- `a2a-registry.org` probe → `research/a2a-registry-probe.md`. Classify: **dead / directory-only / alive-with-traction.**
- A2A v2 roadmap read → `research/a2a-v2-roadmap.md`. Any mandatory-registry signal?
- **48h pivot window opens if probe classifies as alive-with-traction.** Default bias (LOCKED.md): narrow to solo-builder viral lane. Do not re-litigate.

**Gate:** staging reachable at `staging.foxbook.dev` serving hello-world; Sentry catching a synthetic error; a2a-registry probe classification committed.

### Day 4 — Fri Apr 24
**Engineering**
- Merkle log append path. Functions: `append_leaf`, `get_inclusion_proof`, `get_consistency_proof`, `publish_root`. TypeScript V1 is fine if p99 <50ms on append at 100 rps under synthetic load — measure and confirm. Go/Rust daemon deferred to week 2 if TS insufficient.
- `transparency.foxbook.dev` read-only view scaffolded: latest root hash, leaf browsing, inclusion proof fetch.
- AgentCard validator wired into every inbound manifest path.
- Pre-pop scraper skeleton (`apps/scrapers/github/`): GitHub code search for `agent-card.json`, `agent.json`, `skill.md`, `mcp.json`. Rate-limited, respects robots. Writes `tier=0, inferred=true` shadow URLs.

**Benjamin**
- Hero outreach: 25 responses, 15 soft commits target.
- Designer status check. If no reply, Benjamin does 30-min placeholder fox SVG pass.

**Gate:** Merkle log append p99 <50ms at 100 rps; scraper has minted first 500 shadow URLs against live GitHub.

### Day 5 — Sat Apr 25
**Engineering**
- Firehose envelope draft at `schemas/envelope.v1.json`, published at `foxbook.dev/schemas/envelope/v1.json` as `envelope_version: "1.0-draft"`. **NOT frozen yet** — freeze target is day 7-9, gated on "claim flow + Merkle log stable enough that shape won't shift under us," not the calendar.
- Claim flow scaffolding: `POST /api/v1/claim/start`, `POST /api/v1/claim/verify-gist`. State machine `unclaimed → gist-pending → tier1-verified → tier2-pending → tier2-verified`. `adapters/gist/` does HTTP polling (no API key, no auth).
- **Capability taxonomy review pass** (Claude + Benjamin, ~2h pairing). Cross-ref 22 categories against scraped live AgentCards. Trim, expand, freeze as `schemas/capabilities.v1.json`.

**Benjamin**
- Scout roster finalization: each of the 5-10 scouts mapped to its real external user app (what's the honest-delegation source?). Commit to `research/scout-roster.md`.

**Gate:** envelope draft published; claim flow demoable on staging Tier 0 → Tier 1 via Gist; taxonomy v1 committed.

### Day 6 — Sun Apr 26
**Engineering**
- `adapters/dns/` DNS TXT challenge + `adapters/endpoint-challenge/` nonce round-trip for Tier 2.
- Key rotation / revocation data path: recovery key gen at claim, revocation record schema, recovery-signed revocation → Merkle log, verifier rejects post-revocation sigs. Harness starts.
- Discovery API v0: `GET /api/v1/discover` Postgres-only, ranking stub. Establishes the contract; Meilisearch is week 2.

**Benjamin**
- Hero outreach: 40 responses, 25 soft commits target.
- SLO load-test plan draft: load curves, k6 vs Artillery, infra, pass/fail thresholds per foundation §11.1.

**Gate:** Tier 1 + Tier 2 claim flow e2e on staging; discovery API returns correct results (latency optimization week 2); revocation harness running a scripted scenario.

### Day 7 — Mon Apr 27 — week close
**Engineering**
- Key rotation / revocation flow **end-to-end test passes on staging**: compromised key → recovery-key-signed revocation → new key published → old-key sigs reject, new-key sigs accept, full chain visible on `transparency.foxbook.dev`. (One day ahead of foundation §18's day-10 target.)
- Firehose Durable Object prototype on staging: one event in, fans out to N WebSocket subscribers. Measure p50/p95 staleness on synthetic load.
- Scout skeleton in `apps/scouts/translation-scout/`: A2A client hello-world + x402 adapter stub. Not transacting yet.

**Benjamin**
- **SLO load-test plan committed** → `ops/load-test/plan.md`.
- Hero outreach status: 50+ soft commits on track for 100 by day 14?
- Week-1 retrospective → `docs/retros/week-01.md` (template below).

**Gate:** all week-1 deliverables landed or explicitly triaged to week 2; retro identifies top 3 risks for week 2; week-2 plan drafted Monday night.

---

## Dependency tree (what blocks what)

```
Hosting stack locked (day 3)
  └→ Staging reachable (day 3)
       └→ Merkle log append (day 4)
            └→ Key rotation e2e (day 7)
            └→ Firehose envelope freeze (day 7-9)
                 └→ Scouts transact (week 2+)

Ed25519/JWS primitives (day 2)
  └→ Claim flow scaffolding (day 5-6)
       └→ Tier 2 challenge-response (day 6)
            └→ Scout consent rule satisfiable (week 2)

Scraper skeleton (day 4)
  └→ Live AgentCard samples (day 4-5)
       └→ Taxonomy review (day 5)

Hero outreach starts day 1
  └→ 100 hero commits by day 14
       └→ Week-2 real claims for scout targets
            └→ Firehose populated for week-3 load test
```

**The critical path to week-3 load test:** hosting (d3) → Merkle log (d4) → envelope freeze (d7-9) → first scout tx on staging (wk2) → discovery on Meilisearch (wk2) → prod deploys (wk3). A slip on day 3 cascades to a missed week-3 load test. **Day 3 is the most load-bearing day of the week.**

---

## Weekly retro template

Copy to `docs/retros/week-NN.md` every Monday night.

```markdown
# Week NN retro — YYYY-MM-DD

## Shipped
- [x] Deliverable A
- [x] Deliverable B

## Slipped / triaged
- Deliverable C → moved to week NN+1 because...

## Against abandon triggers
- Registered agents with ≥1 paid tx: N / 50 target
- Firehose p95 staleness: Xs
- Discovery p99: Xms
- Claims: N
- Anything tracking toward 90-day triggers? (incumbent moves, standards signals)

## Against the north star
- Firehose feel alive? Yes / No. If no: what's the fix?
- Any architectural decision this week that puts p95 <60s at risk?

## Top 3 risks for next week
1.
2.
3.

## Gut-check (Benjamin)
- (Week 1) a2a-registry narrow-vs-compete posture?
- (Week 1) Envelope schema feel right or wrong?
- (Week 1) Any drift toward enterprise / compliance / future-proofing?
- (Week 3) Does the firehose feel dead? Anyone screenshotting?
- (Week 6) Count the paid-tx-per-agent. 50 or no?
```

---

## What this plan does NOT do (by design)

- Does not re-open locked design decisions. Those live in `LOCKED.md` + `foxbook-foundation.md`.
- Does not plan for enterprise features, paid tiers, or compliance SKU in V1. Those are V3.
- Does not rely on HN/Reddit/PH launches as primary distribution. Those are supplementary.
- Does not plan ad spend, partnership deals, or inbound commitment from hyperscalers.

---

**Track weekly. Cut ruthlessly. Protect the 60-second moment. Ship.**
