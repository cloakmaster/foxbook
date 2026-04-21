# CLAUDE.md — Foxbook repo

You are working on **Foxbook** — the Agent Work Exchange. Neutral, cross-platform, cryptographically verified directory and marketplace where AI agents hire other AI agents. foxbook.ai. Pitch: "List your agent. It starts getting work."

**Status:** week 1 of a 4-6 week focused build (started 2026-04-21). All design is locked at 12/10 confidence. You are here to execute, not to re-open design.

---

## Read before touching code

Authoritative docs live at `docs/foundation/` (synced from Benjamin's port folder):

1. **`docs/foundation/LOCKED.md`** — one-page pin of non-negotiables, SLOs, abandon triggers, decision rules. Check this every time.
2. **`docs/foundation/foxbook-foundation.md`** — 19-section authoritative foundation doc.
3. **`PROJECT-PLAN.md`** — week-by-week execution tracker.

If a design decision arises: check `LOCKED.md` first, then the foundation doc. If covered, follow. If not covered, propose explicitly citing the adjacent section and wait for confirmation. Do not silently drift.

---

## The north star (pinned — supersedes other concerns)

> The first agent that hires another agent on the firehose and the transaction shows up publicly within 60 seconds — that's the moment. Everything else is plumbing.

Load-bearing SLO: **firehose staleness p95 <60s.** Every architectural decision must serve this. If a change puts p95 at risk, the change is wrong.

---

## The one architectural rule that cannot bend

**Service-agnostic core.** Code in `core/` has **zero** references to:
- specific capability names (no `"translation"` literal)
- specific payment rails (no `x402` import)
- specific frameworks (no `langchain` import)
- specific third-party services (no `anthropic`, `openai`, `github`, `coinbase`)

All service-specific logic lives in `adapters/<service>/`. Adding a new integration = **zero core changes**. This is enforced via a lint rule in CI. If your change triggers it, the right answer is almost always to push the logic into an adapter, not to weaken the rule.

This rule saved DeskDuck (Benjamin's prior product) from N pivots. It will save Foxbook when the payment-protocol or framework landscape shifts mid-build. Respect it.

---

## Locked commitments (partial — full list in LOCKED.md)

- **Manifest** = Google A2A AgentCard superset with `x-foxbook` extensions. No parallel format.
- **Payment** = x402 canonical. AP2 / Stripe MPP secondary. No escrow — settlement is peer-to-peer.
- **Crypto** = Ed25519 + JWS + own Merkle transparency log + `did:foxbook:{ULID}`. Sigstore is optional Tier 4 only.
- **Tier 1 verification** = GitHub Gist primary; tweet + email secondary. All three produce Tier 1.
- **Liveness** = Agentic Turing Test on every heartbeat (signed nonce + micro-reasoning puzzle). Server-only heartbeat is rejected.
- **Namespace** = rooted to verified asset (domain / @X / gh:handle). Immutable `did:foxbook:{ULID}` underneath. No bare strings.
- **Composability** = V1 is metadata-only. Single-hop x402 settlement only. No `revenue_split_pct`. Multi-hop chains = separate firehose rows, each with its own settlement. V2 adds automated splits.
- **Firehose envelope** = published at `foxbook.ai/schemas/envelope/v1.json`. Frozen before any scout writes to it (not on a calendar date). Additive changes only within v1.x. Breaking changes = `envelope_version` bump + ≥90-day deprecation.
- **Free forever in V1.** No paid tiers. No enterprise features. No compliance SKU. Enterprise motion is V3.
- **Scout consent rule:** scouts transact only with (a) Foxbook-registered claimed agents OR (b) agents publishing A2A AgentCards with explicit `pricing`. Never scrape-to-transact on third parties.

---

## Committed SLOs (load-tested by end of week 3 — non-negotiable)

| Surface | Metric | Target |
|---|---|---|
| Discovery API | p50 | <500ms |
| Discovery API | p99 | <1.5s |
| Hire-and-Report envelope | p50 | <2s (Foxbook side) |
| Firehose staleness | p50 | <30s |
| Firehose staleness | **p95** | **<60s** |
| Profile page TTFB | p50 | <400ms |
| OG image render | p99 | <1.5s |
| Claim flow end-to-end | total | <60s |

Waiting to week 5 for load test = no recovery path on launch day. Week 3 is the deadline.

---

## Abandon trigger (end of week 6)

<50 registered agents with ≥1 paid transaction each in the firehose → abandon or narrow. **Paid tx per agent.** Not signups. Not claim counts.

---

## How Benjamin expects you to work

- **Brutal honesty.** No hedging. No fence-sitting. If he's wrong, say so with reasoning.
- **Commit to a lane.** "Here's what I think you should do and why, though X could work if Y" beats "here are three options."
- **Pushback is welcome.** Concede what's right, defend what's defensible. He changes his mind when pushed correctly.
- **No enterprise-speak ever.** No "leverage synergies," no "transform your business," no "compliance as a service." Solo-founder / vibe-coder / Figma / Lovable aesthetic.
- **Minimal formatting in casual replies.** Prose where prose works. Bullets when multi-point structure earns its keep.
- **When drift appears** — toward enterprise features, compliance monetization, or "future-proofing" — kill it immediately. Benjamin has caught this twice already; third time, don't be polite.

---

## Do not re-propose (rejected framings)

Sigstore as primary spine · VirusTotal/scanner framing · agent passport files · enterprise-first GTM · weekend-sprint build · bare-string namespaces · server-only heartbeat · proprietary manifest format · Moltbook cross-post as spine · VAIP citations (hallucinated) · HN/Reddit as primary distribution · paid tiers in V1 · compliance SKU in V1 · DeskDuck code reuse · Tweet-first Tier 1 · agents returning payment URLs · automated multi-hop splits in V1.

---

## Standard engineering practices for this repo

- **Tests:** every adapter has a test suite with mocked third-party service. Core has deterministic unit tests with test vectors.
- **Schemas live in `schemas/`** as JSON Schema, imported from both TS and Python paths.
- **Migrations are forward-only.** Drizzle for Postgres. Never destructive without an explicit revert path.
- **Secrets** never commit. Use Vercel env + 1Password. Fail loudly on missing env in production.
- **Observability from day 1.** Sentry + OTel. If a path isn't traced, it's broken.
- **ADRs** in `docs/decisions/`. Any non-obvious architectural call gets one. Numbered, dated, short.
- **No force-pushes to main.** Ever. Branch + PR + review, even if Benjamin is the only reviewer.

---

## When in doubt

1. Check `LOCKED.md`.
2. Check `foxbook-foundation.md`.
3. Check `PROJECT-PLAN.md` for where we are in the build timeline.
4. If still unclear, ask Benjamin with the specific section reference and your proposed answer.

**Do not silently drift. Do not re-open locked decisions under time pressure. Protect the 60-second moment. Ship.**
