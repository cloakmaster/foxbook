# Outreach roster — Week-2 Distribution Track

**10 named targets across MCP / A2A / framework / security-analyst lanes** (Day-8 web research filled prior placeholders). Per-target DM template, send tracking, reply tracking, and the load-bearing **`verifier_run`** column — the Week-2 leading indicator from [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers + [`distribution.md`](distribution.md) §8.

DMs are drafted in this PR; **sending happens through Benjamin's accounts** (X / GitHub / Mastodon) — the agent that drafted these does not own the credentials and does not send. Once a DM goes out, update the row's `DM_sent_at` + `replied_at` + `replied_text_summary` + `verifier_run` columns by hand.

Names + handles below were confirmed via GitHub profile metadata + repo commit history + GraphQL discussion API (citations per row). For each target, the table cites the strongest verifiable artifact tying them to the role, not just a Twitter follow count.

---

## Roster (10 targets, named per lane)

### MCP team contacts (Anthropic + Microsoft early adopters)

| # | name | handle / role | strongest artifact | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|---|
| 1 | David Soria Parra | [@dsp-ant](https://github.com/dsp-ant) — MCP Lead Maintainer (Anthropic, since Jan 2026) | 413 commits to [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol); cited as lead maintainer in the [Jan 2026 MCP Core Maintainer Update](https://blog.modelcontextprotocol.io/posts/2026-01-22-core-maintainer-update/) | _pending_ | — | — | ☐ |
| 2 | Den Delimarsky | [@localden](https://github.com/localden) — Member of Technical Staff @ Anthropic | 809 commits (top contributor) to [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol); GitHub bio confirms Anthropic affiliation | _pending_ | — | — | ☐ |

### A2A spec maintainers (Linux-Foundation-hosted, multi-vendor TSC)

| # | name | handle / role | strongest artifact | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|---|
| 3 | Holt Skinner | [@holtskinner](https://github.com/holtskinner) — Developer Advocate, Google Cloud AI | 176 commits (top contributor) to [a2aproject/A2A](https://github.com/a2aproject/A2A); GitHub bio confirms Google role | _pending_ | — | — | ☐ |
| 4 | Darrel Miller | [@darrelmiller](https://github.com/darrelmiller) — Partner API Architect, Microsoft; A2A TSC member; IETF HTTPAPI WG Chair; former OpenAPI Spec Editor | GitHub bio: "LF A2A TSC Member". Highest-leverage governance contact — sits on the 8-vendor TSC ([governance](https://github.com/a2aproject/A2A/blob/main/GOVERNANCE.md)) with spec-editor pedigree | _pending_ | — | — | ☐ |

### Framework authors (LangGraph / CrewAI / AutoGen / Mastra)

| # | name | handle / role | strongest artifact | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|---|
| 5 | Nuno Campos | [@nfcampos](https://github.com/nfcampos) — LangGraph maintainer | 2,262 commits (top) to [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | _pending_ | — | — | ☐ |
| 6 | João Moura | [@joaomdmoura](https://github.com/joaomdmoura) — CrewAI founder | 581 commits (top) to [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI); GitHub bio: "Founder of crewAI" | _pending_ | — | — | ☐ |
| 7 | Eric Zhu | [@ekzhu](https://github.com/ekzhu) — AutoGen lead (formerly Microsoft Research) | 473 commits (top) to [microsoft/autogen](https://github.com/microsoft/autogen); GitHub bio: "Building AI agent systems" | _pending_ | — | — | ☐ |
| 8 | Abhi Aiyer | [@abhiaiyer91](https://github.com/abhiaiyer91) — CTO, Mastra | 1,528 commits (top) to [mastra-ai/mastra](https://github.com/mastra-ai/mastra); GitHub bio: "CTO @mastra-ai" | _pending_ | — | — | ☐ |

### Agent-security analyst voices

| # | name | handle / role | strongest artifact | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|---|
| 9 | Simon Willison | [@simonw](https://github.com/simonw) — Datasette; AI-engineering blog author | Coined the "lethal trifecta" framing for AI agent security; prior MCP-prompt-injection writeup at [simonwillison.net](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/); high-leverage AI-engineering audience | _pending_ | — | — | ☐ |
| 10 | Kwame Nyantakyi | [@Kzino](https://github.com/Kzino) — author of IETF `draft-nyantakyi-vaip-agent-identity-01` + A2A Discussion [#1752 (Standard trust/identity extension field on Agent Cards)](https://github.com/a2aproject/A2A/discussions/1752) | Active spec-author in the agent-identity space; personal site [kwamenyantakyi.com](https://kwamenyantakyi.com) | _pending_ | — | — | ☐ |

**Notable adjacent voice (no direct DM — engage via thread):** [`@kenneives`](https://github.com/kenneives) is the author of A2A Discussion [#1734 RFC: Composable Trust Evidence Format](https://github.com/a2aproject/A2A/discussions/1734) (97 comments, 5+ providers actively interoperating: AgentGraph, MoltBridge, Verascore, RNWY, AgentID) AND of the [AgentGraph](https://agentgraph.co) product. GitHub profile is anonymized so direct DM isn't appropriate; engagement happens via reply on the public RFC thread once we file ours.

---

## Strategic context — why these targets, in this order

The 2026-04-28 web-research pass surfaced **four pre-existing trust/identity discussions on A2A** (#1631 Reputation-Aware Agent Discovery, #1720 AgentGraph Show-and-Tell, #1734 RFC Composable Trust Evidence, #1752 Standard trust/identity extension field). The space is more crowded than PR #38's RFC text assumed.

**Foxbook's positioning has to be:**

> **Upstream of trust scoring**, not in competition with it. We provide the verification primitive (cryptographic identity + transparency log + revocation); reputation/scoring layers above. We deliberately reject numeric trust scores in our verification surface per ADR 0006 §4.

This sharpens the DM framing for #3 (Holt Skinner) and #10 (Kwame Nyantakyi) specifically — both are deep in the trust/identity proposals already and need to see Foxbook as **complementary**, not as another scheme competing for the same field.

PR #38's `docs/rfc-a2a-x-foxbook-extension.md` was written assuming greenfield; **it needs a Day-9 revision** acknowledging #1734 + #1752 explicitly and naming the verification-primitive-vs-evidence-format split. Filed for follow-up.

---

## DM template (base)

The base framing for all 10 — adapt per recipient (DMs 1, 3, 9 below show three distinct adaptations):

> Hi [name],
>
> I built a reference implementation of the **agent-verification primitive** that [your spec / your framework / your security-research framing] needs underneath any trust-scoring or evidence-format work — Foxbook: Ed25519 + RFC-9162-shaped Merkle transparency log + recovery-key revocation, Apache-2.0-licensed, JSON-Schema interop.
>
> The live transparency log already caught a real handle-hijack attempt — see [evidence](https://github.com/cloakmaster/foxbook/blob/main/ops/evidence/2026-04-24-identity-guard-adversarial.md). Short version: cloakmaster posted another GitHub user's verification code in their own Gist; the verifier refused with `409 identity-mismatch` and `fetchCount === 0` at the adapter — no Gist content was ever read. The identity check ran against the URL's path-segment owner before any network I/O.
>
> The runtime-safety wrapper is `await foxbookVerifyAgentCard(card)` — four discriminated outcomes mapping to {allowed, blocked, blocked, warning}. **No numeric trust score** in the response shape; verification (objective, cryptographic) is kept strictly separate from reputation (subjective, deferred).
>
> — Benjamin / @cloakmaster

---

## DM #1 — David Soria Parra (MCP lead, target #1)

```
Hi David,

I built and shipped a reference implementation of the agent-verification
primitive that MCP's identity story will need underneath any tool-poisoning
defence — Foxbook: Ed25519 + RFC-9162-shaped Merkle transparency log +
recovery-key revocation, Apache-2.0-licensed, JSON-Schema interop.

The live transparency log already caught a real handle-hijack attempt — see
ops/evidence/2026-04-24-identity-guard-adversarial.md
[https://github.com/cloakmaster/foxbook/blob/main/ops/evidence/2026-04-24-identity-guard-adversarial.md].
cloakmaster posted another GitHub user's verification code in their own Gist; the
verifier refused with 409 identity-mismatch and fetchCount === 0 at the
adapter — no Gist content was ever read.

An MCP server (`@foxbook/mcp-server`) exposing three verification tools
ships this week:
  • foxbook_verify_agent(handle) → {tier, revoked, did, leafIndex}
  • foxbook_get_inclusion_proof(leaf_index) → proof + STH
  • foxbook_check_revocation(did, ed25519_public_key_hex) → revoked?

The runtime-safety wrapper is `await foxbookVerifyAgentCard(card)` —
four discriminated outcomes (verified / unverified / handle-mismatch /
stale-proof). No numeric trust score; verification is kept strictly
separate from reputation per our ADR 0006.

Live Worker: https://foxbook-transparency.inkog-io.workers.dev
RFC: https://github.com/cloakmaster/foxbook/blob/main/docs/rfc-a2a-x-foxbook-extension.md

What blocks you from referencing this in the MCP identity guidance?

— Benjamin / @cloakmaster
```

## DM #2 — Holt Skinner (A2A top contributor, target #3)

```
Hi Holt,

I've been reading the active A2A trust/identity discussions (#1734
composable trust evidence, #1752 standard identity extension, #1631
reputation-aware discovery) and built what I think is the verification
primitive sitting upstream of all four — Foxbook: Ed25519 + RFC-9162-shaped
Merkle transparency log + recovery-key revocation + JSON-Schema interop,
Apache-2.0-licensed, ~140-LOC reference SDK.

Differentiation: we deliberately reject the numeric trust score in our
verification response. `verifyAgentCard(card)` returns one of four
discriminated outcomes (verified / unverified / handle-mismatch /
stale-proof). The score-vs-no-score boundary is the load-bearing design
choice — we're upstream of attestations, not yet another scheme competing
for the same field.

Live evidence: the transparency log already caught a real handle-hijack
attempt — cloakmaster posted another GitHub user's verification code in their own
Gist; the verifier refused with 409 identity-mismatch + fetchCount === 0
at the adapter (zero Gist content ever read). Transcript:
ops/evidence/2026-04-24-identity-guard-adversarial.md.

I've filed an A2A Discussion proposing `x-foxbook` v1 as a registered
extension namespace, framed as verification-primitive-upstream-of-
evidence-format rather than competing trust scheme:
https://github.com/a2aproject/A2A/discussions/1803

What blocks you (and the Google-side TSC voices) from referencing the
adversarial-demo evidence + the verification primitive in the spec's
identity section?

— Benjamin / @cloakmaster
```

## DM #3 — Simon Willison (security-analyst, target #9)

```
Hi Simon,

I read your "lethal trifecta" framing + the MCP-prompt-injection writeup
from earlier this year and built what I think is the missing primitive
in the agent-identity layer those papers imply.

Foxbook is a reference implementation of cryptographic agent verification:
Ed25519 + RFC-9162-shaped Merkle transparency log + recovery-key revocation
+ JSON-Schema interop. Apache-2.0-licensed. ~140-LOC reference SDK. The live log
already caught a real handle-hijack attempt — cloakmaster tried to claim
another GitHub user's identity via the Gist verification flow; the verifier
refused at the adapter with 409 identity-mismatch and 0 bytes of Gist
content read. The identity check runs against the URL's path-segment
owner before any network I/O, structurally precluding handle-spoofing.

Transcript:
https://github.com/cloakmaster/foxbook/blob/main/ops/evidence/2026-04-24-identity-guard-adversarial.md

Live transparency Worker:
https://foxbook-transparency.inkog-io.workers.dev

Runtime-safety wrapper: `await foxbookVerifyAgentCard(card)` before any
agent-to-agent call. Four discriminated outcomes — no numeric trust
score, no aggregate ranking. Verification (cryptographic) is kept
strictly separate from reputation (subjective). This matters because
the AgentGraph + MoltBridge + Verascore composability RFC at
a2aproject/A2A discussion #1734 builds attestation envelopes on top;
Foxbook is one of the underneaths their gateway can compose against.

Worth a 5-minute look. If the adversarial-demo + the verification
primitive don't close the gap your trifecta framing exposes, what's
missing?

— Benjamin / @cloakmaster
```

---

## The `verifier_run` column — Week-2 leading indicator

**Definition (from [`distribution.md`](distribution.md) §8 + [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers):** did the recipient successfully run verification against a Foxbook claim within 5 minutes of receiving the DM, with zero follow-up Q&A from Benjamin?

The column is binary: ☑ or ☐. There's no "tried and got stuck" half-credit. The whole point of the metric is **clarity-without-handholding** — if the SDK + docs aren't self-serve, the metric correctly fails to fire.

**10 of 10 by end of week 2** = the agent-hiring-gate framing + reference SDK + adversarial demo are landing. Next move is doubling down.

**< 10 of 10 by end of week 2** = the framing isn't carrying its weight. Rethink before scaling outreach. Common failure modes to look for:

- Recipient couldn't find the SDK install instructions — implementation gap; fix docs.
- Recipient understood the SDK but didn't see why it mattered — framing gap; rewrite the headline.
- Recipient saw the adversarial demo and asked "ok but does it scale?" — narrative gap; the live transparency log answers this, surface it harder.
- Recipient went silent — the hardest signal; means the question wasn't compelling. Re-do the work, not just the DM.

This indicator is operationalised per [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers. < 10 of 10 is **not** an instant abandon — it's a "this approach isn't working in its current form" signal. Pivot the framing, not the entire thesis.

---

## Send-discipline rules (week-2 execution)

These are binding when DMs go out — not aspirations.

1. **No bulk-send.** Each DM is hand-personalized to the target's published work. The ~5-minute personalization is the cost of getting a real reply.
2. **No follow-up before 5 business days.** A reminder before the 5-day mark optimizes for the wrong response (perfunctory).
3. **One follow-up max** if no reply. The follow-up references something specific from their published work + the demo URL — not "just bumping this."
4. **No marketplace pitch in any DM**, ever. ADR 0006 §1 framing: offer-of-work-already-done, not request-for-attention. If a DM accidentally drifts toward marketplace framing on revision, scrap it and rewrite from §1.
5. **Reply-tracking is honest.** "polite-no" gets logged the same way as "interested." Both are signal; treating one as failure is what kills the indicator's usefulness.
6. **Verifier-run timing is recorded.** The 5-minute window is from DM-receipt timestamp (or first observed open) to the recipient's first verifier hit against the live log. The transparency Worker logs IP + leaf-index queries; cross-reference with the DM send log.

---

## References

- [`distribution.md`](distribution.md) — Week-2 Distribution Track headline framing.
- [`rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) — RFC text recipients land on. **Day-9 follow-up needed: revise to acknowledge A2A discussions #1734 / #1752 / #1631 / #1720 + name the verification-primitive-vs-evidence-format split explicitly. PR #38's text was written assuming greenfield; field is crowded.**
- A2A upstream Discussion (filed 2026-04-29): https://github.com/a2aproject/A2A/discussions/1803
- [`packages/sdk-claim/`](../packages/sdk-claim) — six-function reference SDK; the contract recipients reference.
- [ADR 0006 — protocol-not-marketplace](decisions/0006-protocol-not-marketplace.md) — §1 framing that constrains every DM; §4 path-ordering rule that grounds the no-trust-score stance.
- [PROJECT-PLAN.md](../PROJECT-PLAN.md) — Abandon Triggers + 6/12-month tests + Week-2 Distribution Track operational scope.
- Adversarial demo — [`ops/evidence/2026-04-24-identity-guard-adversarial.md`](../ops/evidence/2026-04-24-identity-guard-adversarial.md)
