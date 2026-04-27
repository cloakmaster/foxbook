# Outreach roster — Week-2 Distribution Track

**10 named targets across MCP / A2A / framework / security-analyst lanes.** Per-target DM template, send tracking, reply tracking, and the load-bearing **`verifier_run`** column — the Week-2 leading indicator from [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers + [`distribution.md`](distribution.md) §8.

DMs are sent during week 2 (not in this PR). Today's PR ships the roster + template; the SDK signatures + RFC text it references are the artifacts the recipient lands on when they click through.

---

## DM template

The same 100-word framing across all 10 targets. Variations are minimal — the load-bearing pieces (adversarial demo, hiring-gate wrapper, "what blocks you from referencing this") stay constant.

> Subject: I built the verification layer your spec assumes
>
> Hi [name],
>
> I built the reference implementation of the verification layer [your spec / your framework / the agent-security writeup you published] assumes — and the live transparency log already caught a real handle-hijack attempt (evidence: [URL]).
>
> The wrapper that matters is `await foxbookVerifyAgentCard(card)` before any agent-to-agent call. Four discriminated outcomes: verified → allowed, unverified → blocked, handle-mismatch → blocked, stale-proof → warning. No numeric trust score; just cryptographic verification.
>
> Reference SDK: [packages/sdk-claim](https://github.com/cloakmaster/foxbook/tree/main/packages/sdk-claim) — six functions, ~130 LOC. Live verifier: [URL]. RFC text: [URL].
>
> What blocks you from referencing this?
>
> — Benjamin

The "what blocks you" close is deliberate: it's a *question*, not a pitch. If they have a blocker, surfacing it is the win. If they don't, the next step is obvious.

---

## Roster (10 targets, named per lane)

Sending order is roughly top-to-bottom — the MCP / A2A spec authors are the highest-leverage targets because their references propagate downstream to every framework consumer.

### MCP team contacts

| # | name | role / affiliation | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|
| 1 | TBD — MCP protocol author | Anthropic, MCP spec | _pending_ | — | — | ☐ |
| 2 | TBD — MCP early-adopter SDK author | independent / framework | _pending_ | — | — | ☐ |

The two slots above stay name-anonymized until the DM is actually sent — Benjamin has the named list in 1Password; this file is public and we don't pre-burn the targets in a public commit. Each row gets a name + linked profile when the DM goes out.

### A2A spec maintainers

| # | name | role / affiliation | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|
| 3 | TBD — A2A spec working group | Google, A2A AgentCard spec | _pending_ | — | — | ☐ |
| 4 | TBD — A2A reference SDK contributor | community | _pending_ | — | — | ☐ |

### Framework authors

| # | name | role / affiliation | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|
| 5 | TBD — LangGraph maintainer | LangChain | _pending_ | — | — | ☐ |
| 6 | TBD — CrewAI maintainer | CrewAI | _pending_ | — | — | ☐ |
| 7 | TBD — AutoGen maintainer | Microsoft Research | _pending_ | — | — | ☐ |
| 8 | TBD — Mastra maintainer | Mastra | _pending_ | — | — | ☐ |

### Agent-security analyst voices

| # | name | role / affiliation | DM_sent_at | replied_at | replied_text_summary | **verifier_run** |
|---|---|---|---|---|---|---|
| 9 | TBD — agent-security analyst | independent | _pending_ | — | — | ☐ |
| 10 | TBD — runtime-safety researcher | academia / industry | _pending_ | — | — | ☐ |

---

## The `verifier_run` column — Week-2 leading indicator

**Definition (from [`distribution.md`](distribution.md) §8 + [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers):** did the recipient successfully run verification against a Foxbook claim within 5 minutes of receiving the DM, with zero follow-up Q&A from Benjamin?

The column is binary: ☑ or ☐. There's no "tried and got stuck" half-credit. The whole point of the metric is **clarity-without-handholding** — if the SDK + docs aren't self-serve, the metric correctly fails to fire.

**10 of 10 by end of week 2** = the agent-hiring-gate framing + reference SDK + adversarial demo are landing. The next move is doubling down on the framing.

**< 10 of 10 by end of week 2** = the framing isn't carrying its weight. Rethink before scaling outreach. Common failure modes to look for:

- Recipient couldn't find the SDK install instructions — implementation-side gap; fix docs.
- Recipient understood the SDK but didn't see why it mattered — framing gap; rewrite the headline.
- Recipient saw the adversarial demo and asked "ok but does it scale?" — narrative gap; the live transparency log answers this, surface it harder.
- Recipient went silent — the hardest signal; means the question wasn't compelling. Re-do the work, not just the DM.

This indicator is operationalised per [PROJECT-PLAN.md](../PROJECT-PLAN.md) Abandon Triggers. < 10 of 10 is NOT an instant abandon — it's a "this approach isn't working in its current form" signal. Pivot the framing, not the entire thesis.

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
- [`rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) — RFC text recipients land on.
- [`packages/sdk-claim/`](../packages/sdk-claim) — six-function reference SDK; the contract recipients reference.
- [ADR 0006 — protocol-not-marketplace](decisions/0006-protocol-not-marketplace.md) — §1 framing that constrains every DM.
- [PROJECT-PLAN.md](../PROJECT-PLAN.md) — Abandon Triggers + 6/12-month tests + Week-2 Distribution Track operational scope.
- Adversarial demo — [`ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md`](../ops/evidence/2026-04-24-identity-guard-cloakmaster-vs-samrg472.md)
