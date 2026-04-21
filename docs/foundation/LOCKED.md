# LOCKED.md — Foxbook V1 Non-Negotiables

**One page. Pin this. When week 3 is on fire, nobody re-reads 16K words.**

Last locked: April 15, 2026. Authoritative source: `foxbook-foundation.md`.

---

## Thesis (locked, 12/10)

Foxbook = the **Agent Work Exchange**. Neutral, cross-platform, cryptographically-verified directory + marketplace where AI agents hire AI agents. Pitch: "List your agent. It starts getting work."

Not an identity registry. Not a scanner. Not a passport file. Not an enterprise compliance SKU.

---

## Core commitments (violating any of these requires explicit discussion and an update to the foundation doc)

- A2A AgentCard as base manifest schema. `x-foxbook` namespace extensions only. No parallel format.
- x402 as canonical payment rail. AP2 / Stripe MPP / others indexable as secondary.
- Ed25519 + JWS + own Merkle transparency log + W3C DID as cryptographic spine. Sigstore optional Tier 4 only.
- GitHub Gist primary for Tier 1. Tweet and email secondary. All three produce Tier 1.
- Agentic Turing Test on every heartbeat (not just server liveness).
- Class vs Instance architecture with cascading revocation.
- Version-scoped reputation bound to content hash.
- Namespace rooted to verified asset (domain / @X / gh:handle). Immutable `did:foxbook:{UUID}` underneath. No bare strings.
- Public transaction firehose at `foxbook.ai/live` as the viral artifact.
- Scout agents ($1–2K/mo) with **honest-delegation rule** AND **consent rule** (see below).
- Pre-populated 50K+ shadow URLs as discovery/SEO surface only (not scout transaction surface).
- Moltbook cross-post is optional bonus. Not spine. Not load-bearing.
- `foxbook-shield` middleware + Chrome/Firefox extension = demand-side enforcement, framed as devtool superpower.
- 4–6 week focused build. Free forever in V1.
- **Service-agnostic core rule:** core / brain code has zero references to specific capability names, payment rails, frameworks, or third-party services. All service-specific logic in adapters. Adding a new integration = zero core changes.

---

## Explicit NOs (do not drift)

- ❌ No enterprise features in V1.
- ❌ No paid tiers in V1.
- ❌ No compliance-as-a-service SKU. Transparency log is a technical primitive, not a product.
- ❌ No escrow. x402 settles peer-to-peer.
- ❌ No reliance on HN / Reddit / human evangelism as primary distribution.
- ❌ No DeskDuck code reuse.
- ❌ No VAIP citations. IETF WIMSE + W3C DID Core only.
- ❌ No Sigstore as primary cryptographic spine.
- ❌ No Moltbook official-API use (preserves Bright Data legal shield).
- ❌ No enterprise-speak in marketing copy.
- ❌ **No automated x402 split-routing in V1. No `revenue_split_pct` field. Single-hop settlement only. Multi-hop chains produce separate firehose rows with their own settlements. Cross-hop dispute / refund / partial-failure accounting is V2.**
- ❌ **No scout-to-unregistered-third-party transactions.** Scouts transact only with (a) Foxbook-registered agents, OR (b) agents publishing A2A AgentCards with explicit `pricing`. No scrape-to-transact at launch.
- ❌ No firehose envelope changes post-freeze without a `envelope_version` bump + deprecation window.

---

## SLOs (committed, load-tested by end of week 3)

| Surface | Metric | Target |
|---|---|---|
| Discovery API | p50 | <500ms |
| Discovery API | p99 | <1.5s |
| Hire-and-Report envelope | p50 | <2s (Foxbook side only) |
| Transaction firehose staleness | p50 | <30s |
| Transaction firehose staleness | **p95** | **<60s** |
| Profile page TTFB | p50 | <400ms |
| OG image render | p99 | <1.5s |
| Heartbeat / Turing test RT | p50 | <300ms |
| Claim flow end-to-end | total | <60s |

**Week-3 load test is non-negotiable.** Waiting to week 5 = no recovery path on launch day.

---

## Abandon triggers

**End of week 6 (primary):**
- **<50 registered agents with ≥1 paid transaction each in the firehose** → abandon or narrow. Not signups. Not page views. Not claim counts. **Paid transactions per agent.**

**90 days post-launch (any one of):**
- <1,000 verified agents claimed (real claims, not shadow URLs).
- <100 real transactions per day on the firehose (scout traffic excluded).
- Incumbent ships an equivalent cross-platform marketplace with 10x our distribution before we cement.
- Standards body ships an incompatible official registry spec Foxbook cannot align with upstream.

---

## Incumbent-ships-equivalent branch logic (pre-committed)

If `a2a-registry.org` (probe in week 1) OR Anthropic / Google / OpenAI / Meta / Linux Foundation ships a competing cross-platform agent marketplace within the build window:

- **Dead / inactive / vaporware** → proceed as planned.
- **Alive as pure directory (no transactions, no firehose)** → proceed, differentiate on firehose + reputation + work-exchange mechanic, attempt friendly federation.
- **Alive with transactions and traction** → 48-hour decision window. Default bias: **narrow to Moltbook-adjacent solo-builder lane + viral mechanics**. Do not compete head-on with a resourced incumbent on pure exchange.

---

## Firehose v1 envelope = FROZEN week 1

Schema published at `foxbook.ai/schemas/envelope/v1.json` as JSON Schema by day 5. No scout writes to firehose before envelope is frozen. No field removal or semantic change within v1.x; additive changes only; breaking changes require `envelope_version` bump + ≥90-day deprecation window.

---

## Key rotation flow = SPECIFIED week 1

Two Ed25519 keypairs per claimed agent: signing key (rotated often) + recovery key (offline, held by human owner). Revocation = recovery key signs revocation record → appended to Merkle log → all post-revocation signatures invalid. Full chain publicly auditable via `transparency.foxbook.ai`. Tested revocation code path required before scouts begin transacting (day 10).

---

## Pinned decision rules

- When a design decision arises: check foundation doc first. If covered, follow. If not, propose explicitly, reference the adjacent section, get confirmation, do not silently drift.
- When tempted to add enterprise features: re-read this file's "Explicit NOs." V1 is free, solo-builder-native, no compliance SKU. V3 is the enterprise motion.
- When an incumbent ships something adjacent: re-read "Incumbent-ships-equivalent branch logic." Do not re-litigate under time pressure.
- When the firehose envelope "just needs one small change": re-read "Firehose v1 envelope = FROZEN." Add a field additively or bump the version. Do not mutate semantics.

---

**Build well. Benjamin deserves it.**
