# User journey — agent-hiring-gate as the spine

How a developer goes from *"never heard of Foxbook"* to *"foxbookVerifyAgentCard is in our production dispatch loop."*

The spine of every step is the **agent-hiring-gate framing** ([ADR 0006 §1](decisions/0006-protocol-not-marketplace.md), [`distribution.md`](distribution.md) §1): the wrapper `await foxbookVerifyAgentCard(card, opts)` inserted before any agent-to-agent call, returning four discriminated outcomes mapping to {allowed, blocked, blocked, warning}. **No numeric trust score**, by design.

Each step below names the friction the developer hits, the mitigation we ship for it, and the artifact the mitigation lives in. If a step's friction has no mitigation yet, that's a Day-N+ deliverable.

---

## Step 1 — Hears about Foxbook

**The moment:** a DM lands ("I built the verification layer your spec assumes — the live log already caught a real handle-hijack attempt"), a framework's docs reference Foxbook in their identity section, an A2A spec discussion replies cite our Discussion, or a blog post (Simon Willison-tier voice) references the adversarial-demo evidence.

**Friction:**
- *"Why should I trust this isn't another vapor-spec?"* — every trust/identity proposal in the A2A discussion thread is greenfield text without a working reference.
- *"What's the difference between this and the AgentGraph + composability RFC space (#1734) that's already moving?"* — the field is crowded.

**Mitigation:**
- **Live evidence** — the adversarial-demo transcript at [`ops/evidence/2026-04-24-identity-guard-adversarial.md`](../ops/evidence/2026-04-24-identity-guard-adversarial.md). Real `409 identity-mismatch` against real-handle-vs-real-handle, `fetchCount === 0` at the adapter. Not a hypothetical.
- **Strategic positioning** ([`outreach.md`](outreach.md) "Strategic context" section): we are *upstream of* trust scoring, not in competition with it. We provide the verification primitive (cryptographic identity + Merkle log + revocation); reputation/scoring layers above. This framing has to land in the first sentence of every DM and every README.
- **Live transparency Worker** at `https://foxbook-transparency.inkog-io.workers.dev` — clickable, queryable, RFC-9162-shaped. The recipient can `curl /root` from their terminal in <10 seconds.

**Artifact:** [`docs/outreach.md`](outreach.md) (DM templates), [`docs/distribution.md`](distribution.md) (positioning), `ops/evidence/2026-04-24-identity-guard-adversarial.md` (proof).

---

## Step 2 — Lands on the docs

**The moment:** they click through the DM link to `github.com/cloakmaster/foxbook` (or eventually `foxbook.dev` once canonical DNS lands).

**Friction:**
- *"Where do I start?"* — multi-package repo with apps/, adapters/, packages/, schemas/, docs/ — the entry point isn't obvious.
- *"What's the 30-second pitch?"* — README needs to land the agent-hiring-gate framing in the first paragraph.
- *"Where's the SDK?"* — the verifier-runner one-liner needs to be findable in <30 seconds.

**Mitigation:**
- **Day-9 README rewrite** (filed) — top-of-fold: agent-hiring-gate code snippet, link to live Worker, link to SDK, link to RFC, link to adversarial-demo evidence. Five clickable artifacts, in order of "what's the next action they'd take."
- **Distribution.md as the strategic-context source** — when someone asks "ok but why," `docs/distribution.md` answers "agent-hiring-gate framing + cloakmaster adversarial demo + Week-2 leading indicator."

**Artifact:** README.md (Day-9 rewrite filed), [`docs/distribution.md`](distribution.md).

---

## Step 3 — Tries the verifier (the 5-minute self-serve)

**The moment:** they open a terminal and try to verify a Foxbook claim against the live log without asking us anything.

**Friction:**
- *"What command do I run?"* — has to be one line, copy-paste-able from the README or DM.
- *"Where's the SDK install?"* — npm publish hasn't happened yet (week-2 task).
- *"Will this still work in 30 minutes when I get a chance?"* — Worker uptime + transparency log integrity.

**Mitigation:**
- **One-line verifier** — `curl https://foxbook-transparency.inkog-io.workers.dev/root | jq` returns the current STH. That's enough to prove the log is live, signed, and queryable. Lower bar than "install the SDK."
- **Cross-language test vectors** committed at [`schemas/crypto-test-vectors.json`](../schemas/crypto-test-vectors.json) — `jws_round_trip` lets a re-implementer in Go / Rust / Python verify byte-for-byte that their canonicalization matches ours.
- **Inclusion-proof URL** for any leaf the recipient can find in the log — `/inclusion/:index` returns the path; they can re-hash and verify root membership themselves.
- **Worker reliability** — Cloudflare Workers SLA; the artifact at [`ops/bench-results/2026-04-26-first-live-append.txt`](../ops/bench-results/2026-04-26-first-live-append.txt) shows the Worker has been queryable since Day-5 evening.

**Friction NOT yet mitigated:**
- Canonical DNS (`transparency.foxbook.dev`) — placeholder URL is on `inkog-io.workers.dev`. Week-2 binding task.
- SDK npm publish — week-2.

**This step IS the Week-2 leading indicator.** "10 verifier runs without hand-holding" means 10 humans clicked through, ran a command (curl or SDK call), and got a meaningful response within 5 minutes of the DM. See [`distribution.md`](distribution.md) §8.

**Artifact:** Live Worker, `schemas/crypto-test-vectors.json`, `ops/bench-results/`, [`docs/outreach.md`](outreach.md) `verifier_run` column.

---

## Step 4 — Reads the SDK + decides to integrate

**The moment:** the recipient opened the SDK ([`packages/sdk-claim/`](../packages/sdk-claim)) to see the actual API surface they'd integrate against.

**Friction:**
- *"Is this stable enough to depend on?"* — six function signatures; the contract is what they'd lock against.
- *"Does the API surface read like a real product?"* — the wrapper has to feel natural in their dispatch loop.
- *"What's the cost / failure mode?"* — `verifyAgentCard` is in the agent's hot path; latency + error handling matter.

**Mitigation:**
- **Tight surface (~140 LOC strict-typed signatures)** — six functions only, all returning discriminated unions. Nothing surprising. Reading the file is a 5-minute exercise.
- **No-numeric-score commitment** — explicit in the type and ADR 0006 §4. A future planner can't smuggle `{trust_score: number}` into the response without an ADR amendment. The recipient knows the surface won't bloat under future pressure.
- **Day-7 latency bench** — `ops/bench-results/2026-04-27-firehose-latency.csv` shows 20ms median DB-COMMIT → SSE-receive. The verifier path is similar shape (HTTP-cached inclusion proof, Ed25519 verify on-stack); week-3 load test will confirm.

**Friction NOT yet mitigated:**
- **Bodies are stubs** — the SDK ships *signatures + discriminated-union types*. Implementation lands week 2. A recipient can read the contract today but can't `npm install` and run it. This is a real friction; calling it out in the README + DM is the discipline.
- **Caching strategy doc** — for production hot-path use, the verifier should cache STH + inclusion proofs. Filed for Day-9+.

**Artifact:** [`packages/sdk-claim/src/`](../packages/sdk-claim/src), [`docs/rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) (full motivation), `ops/bench-results/2026-04-27-firehose-latency.csv`.

---

## Step 5 — Integrates verifyAgentCard into dispatch loop in production

**The moment:** they wire the wrapper into their framework's request-dispatch pipeline. The line goes:

```typescript
const v = await verifyAgentCard(card, { requireFreshSTH: 3600 });
if (v.status !== "verified") return blockOrWarn(v);
// ...dispatch the agent-to-agent call
```

**Friction:**
- *"What's the failure mode if your Worker is down?"* — production caller needs a fallback strategy.
- *"What happens to in-flight calls when an agent is revoked?"* — revocation propagation latency.
- *"How do I integrate with my existing tracing / observability?"* — `verifyAgentCard` adds a hop; needs OpenTelemetry-shaped integration.
- *"Can I run my own log instance?"* — multi-vendor deployment as protocol-not-marketplace per ADR 0006.

**Mitigation:**
- **Worker fallback strategy doc** (filed for week-2) — recipient can pin a known-good STH offline + verify against it for grace-period offline operation; check primary log on resume.
- **Revocation propagation** — firehose subscription (Day-7 PR #36) gives <60s wall-clock from revocation to scout-side awareness. SLO target.
- **OTel integration story** (filed for week-2 alongside SDK implementation) — the wrapper emits tracing spans for fetch-inclusion-proof + Ed25519 verify boundaries.
- **Multi-vendor deployment** — ADR 0006 §1: anyone can run a parallel log; foxbook.dev is the canonical reference, not the only one. Cross-language test vectors + RFC-9162-shaped contract make alternate deployments byte-compatible.

**Friction NOT yet mitigated (week-2+ targets):**
- Production hot-path caching strategy (see Step 4).
- OTel integration shipped + documented.
- Worker fallback / pinned-STH offline mode.
- Multi-vendor log discoverability ("which logs am I federated against?").

**The success moment:** the recipient ships their next release with `verifyAgentCard` in the dispatch loop. **Reference visible in their published code** (their PR description, their README, their changelog). That's the 6-month adoption test signal per [PROJECT-PLAN.md](../PROJECT-PLAN.md) — *"a framework SDK integrates Foxbook claim verification natively."*

**Artifact:** [PROJECT-PLAN.md](../PROJECT-PLAN.md) 6-month adoption test, [`packages/sdk-claim/`](../packages/sdk-claim) (week-2 implementation), `apps/transparency/` (Worker code that anyone can fork to run their own).

---

## Where this doc lives in the system

- **Linked from:** [`outreach.md`](outreach.md) (DM tone-check), [`distribution.md`](distribution.md) §1 (the framing this doc spines on), every future PR's "Success criteria" paragraph (per [`docs/process/pr-success-criteria.md`](process/pr-success-criteria.md)).
- **Updated:** when a step's friction changes (new mitigation ships, or new friction surfaces from outreach replies).
- **Source of truth for:** "what does success look like for one developer" — the unit of analysis is one human's path, end-to-end.

The doc is short on purpose. If a step takes more than three paragraphs, the friction analysis is in the wrong place; rewrite.
