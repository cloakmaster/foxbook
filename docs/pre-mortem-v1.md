# Pre-mortem — v1 demo (Week 2 → Week 3)

> **Pre-mortem framing:** assume the v1 demo lands badly. What are the top 5 ways it could? What are the top 3 mitigations we should ship to pre-empt them?

The premise of v1 is the "scout discovers agent in <60s via firehose" moment ([CLAUDE.md](../CLAUDE.md) north star, [LOCKED.md](foundation/LOCKED.md) p95 <60s SLO). The demo is what makes it real to the audience — MCP / A2A / framework authors / agent-security analysts. The demo failing means the framing fails, which means the Week-2 leading indicator (10 verifier runs) doesn't move, which means the 6-month adoption test fires the abandon signal at month-4 ([PROJECT-PLAN.md](../PROJECT-PLAN.md)).

This pre-mortem is the discipline for catching demo-day failures before demo day. Reviewed at end of Day 8, end of Week 1, end of Week 2.

---

## Top 5 v1 demo failure modes

### 1. Worker URL down at demo moment

**The shape:** at the moment a recipient clicks the demo URL — `https://foxbook-transparency.inkog-io.workers.dev/root` — the Worker returns 5xx, or the response is delayed past their attention budget (~10s). Recipient closes the tab. The "live verifier" framing falls apart.

**Likelihood:** medium. Cloudflare Workers SLA is high (~99.99%) but our Worker is on a free-tier `inkog-io.workers.dev` placeholder, no canonical DNS, no synthetic monitoring, no alerting. A single CF outage during a demo window kills the framing for that window.

**Severity:** high. Loss of the live-evidence credibility anchor for any recipient hitting it during the outage.

**What it'd cost to recover:** the credibility hit lasts longer than the outage. "I tried it once, it was down" becomes the recipient's mental association.

### 2. External verifier can't reproduce inclusion proof (canonical-bytes drift)

**The shape:** a recipient (Simon Willison-tier voice or a security analyst) tries to reproduce an inclusion proof against the live log using their own JWS / canonicalization implementation in Go / Rust / Python. Their byte serialization differs from ours, so their leaf hash doesn't match the leaf at `/leaf/:index`, so `/inclusion/:index` looks broken from their perspective. They tweet "Foxbook verifier doesn't reproduce."

**Likelihood:** medium-high. Canonical-bytes drift is the bug class ADR 0005 was filed to prevent, and we have cross-language test vectors at `schemas/crypto-test-vectors.json`. But: the recipient might not run those vectors first; they might roll their own canonicalization based on a quick read of the schema. JCS-style edge cases (Unicode escapes, number formatting, key ordering on nested objects) are easy to get wrong.

**Severity:** very high. A tweet from Simon-tier voice saying "Foxbook doesn't reproduce" is harder to recover from than a Worker outage. Trust evaporates.

**What it'd cost to recover:** the public mea culpa + a "here's the canonicalization spec" doc. If we'd shipped that doc up front, no failure.

### 3. A2A spec moves to a different identity model (#1734-style superseding)

**The shape:** between now and the demo, the A2A TSC formally adopts a `Composable Trust Evidence Format` (#1734-style) as the canonical identity surface, and `x-foxbook` is positioned as "one of N legacy proposals." Our outreach DMs land into a context where the spec already moved on.

**Likelihood:** medium. #1734 has 97 comments + 5 active providers; there's real momentum. The 8-vendor TSC could formally adopt it within Q2 2026.

**Severity:** medium-to-high. We're not displaced — the verification primitive sits underneath any evidence format — but the *narrative* gets harder. "Why your thing not the spec's thing" becomes a question we'd have to answer in every DM.

**What it'd cost to recover:** the framing already exists in [`docs/outreach.md`](outreach.md) Strategic context section: *upstream of trust scoring, not in competition*. If we ship that framing on Day-8 and #1734 adopts on Day-15, our Discussion has already established the layering. If we ship the framing on Day-15 after #1734 has adopted, we look reactive.

### 4. MCP team ships native verification primitives

**The shape:** Anthropic announces "MCP v2 includes native agent identity + verification" before our MCP server ships. Foxbook becomes a third-party detail any MCP-native developer can ignore.

**Likelihood:** medium. ADR 0006 §2 names this as a known co-option failure mode. The MCP roadmap shows active identity work; we don't have visibility into Anthropic-internal sequencing.

**Severity:** very high. The MCP-channel half of our distribution motion (Day-8+ MCP server PR #41 candidate) is structurally pre-empted. The A2A half still works (#1734 sits above us, MCP ships native means MCP doesn't need us — these are different ecosystems), but we lose ~50% of the distribution surface.

**What it'd cost to recover:** ship our MCP server FIRST and get it referenced as canonical before Anthropic decides to ship native. The DM #1 (David Soria Parra) asks exactly this question: "what blocks you from referencing this?"

### 5. First 3 outreach DMs all bounce because info is stale

**The shape:** I (the agent that drafted [`outreach.md`](outreach.md)) cited GitHub profile metadata + commit history as of 2026-04-28. Web research can lag reality by months. The recipient's listed company in their bio is from 2024; they've since left; they don't see the DM. Or their preferred channel is Twitter / Mastodon / email, not GitHub-DM, and they don't check GitHub Discussions.

**Likelihood:** medium-high. Profile metadata staleness is real. Channel preference varies wildly across the 10 named targets.

**Severity:** medium. One bounce is a data point; three bounces is a pattern that wastes the first batch of DMs. The verifier_run leading indicator stays at 0 because no one received the DM in a state to act on it.

**What it'd cost to recover:** first 3 DMs are a probe batch; if they all bounce, refine targeting + channel preference before scaling to remaining 7.

---

## Top 3 mitigations (concrete week-2 PRs)

The pre-mortem's job is to convert failure-mode analysis into specific work that pre-empts the failure. These are the three that buy the most insurance per unit of effort.

### Mitigation 1 — Worker uptime + canonical DNS + synthetic monitoring (addresses Failure 1)

**Concrete PR scope:**
- Bind `transparency.foxbook.dev` to the Cloudflare Worker (replaces the `inkog-io.workers.dev` placeholder). Day-8/9 task once `CF_ACCOUNT_ID` resolves.
- Add a synthetic-monitoring cron (UptimeRobot, Cronitor, or self-hosted) that hits `/root` every 5 min from 2+ geographic origins, alerts on 5xx or >5s latency to a Foxbook-internal channel.
- Add a one-page status page (status.foxbook.dev or a static GitHub Pages page) showing current uptime + last-successful-root timestamp + canonical Worker URL. When a recipient asks "is the verifier up?" the answer is one click.
- Document the fallback URL pattern in `docs/user-journey.md` Step 3 — "if `transparency.foxbook.dev` is unreachable, the placeholder `foxbook-transparency.inkog-io.workers.dev` mirrors the same data."

**Why this wins:** turns a single-point-of-failure into a redundancy story. Cost: ~half-day. Insurance: every recipient who hits the demo URL during a future outage gets a "we know, here's the alternate" instead of a closed tab.

### Mitigation 2 — Canonicalization spec doc + cross-language reference verifier walkthroughs (addresses Failure 2)

**Concrete PR scope:**
- New file `docs/canonicalization-spec.md` — explicit specification of the canonical-bytes rule (alphabetical key order, no whitespace, specific number-formatting rules, specific Unicode-escape rules, specific handling of nested objects, specific handling of arrays). Plus the `jws_round_trip` fixture description + a checklist a re-implementer runs through.
- A 50-line Go program in `examples/cross-lang/go/verify-inclusion.go` that consumes the live log + verifies inclusion proofs end-to-end. Mirror in Python (already exists conceptually via the test vectors but not as a runnable example).
- Link from the README + every DM template + the A2A Discussion: "before you say it doesn't reproduce, run this."

**Why this wins:** the failure mode is "recipient gets canonicalization wrong + tweets that we're broken." Putting the spec + a reference verifier in their face *before* they roll their own removes the failure path entirely. Cost: ~1 day. Insurance: Simon-tier voices have a clean reference to compare against; mismatches surface as "your example doesn't reproduce" instead of "Foxbook doesn't reproduce."

### Mitigation 3 — RFC text revision acknowledging crowded field (addresses Failure 3 + 5)

**Concrete PR scope:**
- Revise [`docs/rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) — section §1.2 ("The failure mode this RFC pre-empts") + new §2.5 ("Where this fits with existing A2A trust/identity work") explicitly acknowledging A2A discussions #1734 / #1752 / #1631 / #1720 by reference + naming the verification-primitive-vs-evidence-format split.
- Revise the abstract to lead with "*upstream of, not in competition with*" framing.
- Add a one-paragraph "How to check that we're not duplicating" section pointing readers at the live evidence + adversarial demo + crypto test vectors.
- Filed at end of [`outreach.md`](outreach.md) Strategic Context as "Day-9 follow-up."

**Why this wins:** Failure 3 (A2A spec moves to a different identity model) is mostly a framing failure — if the RFC + outreach DMs already place Foxbook upstream-of-evidence-format, then #1734 adopting doesn't displace us. Failure 5 (DM bounces from stale targeting) is partially addressed because the same revised framing sharpens the DMs' first sentence — a recipient seeing "upstream of trust scoring" is more likely to respond than one seeing "yet another identity proposal." Cost: ~half-day. Insurance: covers two failure modes at once.

---

## Failure modes NOT in the top 5

Considered but not prioritized:

- **Anthropic, Google, or another major vendor publicly opposes Foxbook.** Unlikely; we're not in a position threatening enough to draw deliberate opposition. If it happens, the response is the same as Failure 4 (ship faster).
- **Internal correctness bug in Foxbook surfaces during demo.** Engineering quality is the strongest part of week 1 (10/10 per the verdict in [`feedback_merged_not_live.md`](../../.claude/projects/-Users-tester-foxbook-port/memory/feedback_merged_not_live.md) context). 173 in-process tests + 4 gated integration tests + the verify-gist atomic-tx integration test. Not impossible, but lower-likelihood than the framing/distribution failures above.
- **Verifier_run metric reads 10/10 but the recipients are unconvinced.** Possible (the metric is "ran the verifier in 5 min"; doesn't measure "decided to integrate"). Mitigated by tracking `replied_text_summary` and `verifier_run` as independent columns in `outreach.md`.

---

## Review cadence

- **End of Day 8 (this writing):** initial draft. Reviewed by Benjamin.
- **End of Week 1 (Mon Apr 27):** revisit if Mitigations 1+2+3 have shipped.
- **End of Week 2 (Mon May 4):** post-outreach retrospective — which failure modes actually fired? Which mitigations actually paid off? Update accordingly.
- **Pre-demo (~Week 3):** final pass before public demo day.

The pre-mortem is the discipline that catches demo-day failures before demo day. The mitigations are the work that buys the insurance.
