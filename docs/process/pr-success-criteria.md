# PR success criteria — the standard

Every Foxbook PR body MUST include a `## Success criteria` section naming the **external success moment** the PR enables — what does a real user / scout / integrator / spec-author see if this PR succeeds?

"Tests pass" is not a success criterion. "CI green" is not a success criterion. Both are *necessary preconditions* for the PR to be mergeable; neither describes what success means to a human outside the codebase.

This standard was filed Day-8 after the cross-LLM strategic review observed that Foxbook PRs have been measuring themselves against engineering completeness ("the four writes are atomic," "the 8 discriminated statuses are distinct") rather than user-visible outcomes ("a scout can verify a claim within 5 minutes of receiving a DM"). Both matter; one was missing.

---

## What goes in the section

A 1–3 sentence paragraph naming:

1. **Who** sees the success — by role, not by title. (e.g., *"a developer importing `@foxbook/sdk-claim`"*, *"an A2A spec maintainer reviewing the upstream RFC"*, *"a scout consuming the firehose"*.)
2. **What** they see — a concrete, observable outcome. (e.g., *"the wrapper returns `{status: 'verified', tier: 1}` within 200ms"*, *"the inclusion-proof URL resolves to a JSON document they can verify with their own Ed25519 implementation"*, *"the firehose-tail receives `claim.verified` events within 100ms of commit"*.)
3. **By when** — the time horizon at which we'd check the success moment fired. Usually short (Day-N+1 smoke, end-of-week verification).

If you can't fill in all three, the PR is either too internal to need the section (e.g., a `chore(format)` PR — say so explicitly: *"Internal formatting only; no external success moment."*) or too vague to ship (rewrite the scope before opening the PR).

---

## Examples

### Good

```markdown
## Success criteria

A developer integrating Foxbook into their A2A AgentCard pipeline imports `verifyAgentCard` from `@foxbook/sdk-claim`, calls it before each agent-to-agent dispatch, and observes one of four discriminated outcomes (`verified | unverified | handle-mismatch | stale-proof`) within ~150ms (P95). Day-9 manual verification: a Foxbook engineer drops the wrapper into a sample LangGraph agent, dispatches a request, and the trace logs the discriminated status before the outbound HTTP call fires.
```

✓ Concrete who (developer), concrete what (discriminated outcome + latency budget), concrete by-when (Day-9 manual verification).

### Bad

```markdown
## Success criteria

The implementation is complete and all tests pass.
```

✗ No who, no observable outcome to a human outside the codebase, no by-when. Tells a reviewer nothing about whether the PR did the thing it was supposed to do.

---

## Where to put it

In the PR body, between the *summary / what changed* sections and the *test plan*. The order is intentional: summary → success criteria → test plan. Reading top-to-bottom, the reviewer goes "what's the change → who benefits + how → did the author prove it works."

---

## Backfill

PRs #29 / #36 / #37 / #38 (revocation harness, firehose, Tier 2, Distribution Track) shipped before this standard was filed. The retroactive paragraphs for each are drafted at [`docs/process/backfill-success-criteria.md`](backfill-success-criteria.md) — review there + apply via `gh pr edit` when ready. The history of the merged PRs gets richer; the standard kicks in for every PR going forward.

---

## Lock as standard

This file is the standard. Changes to the format below require an RFC-style discussion in a docs/ PR (this is meta-meta, but the discipline matters — the standard not changing under fatigue is itself a feature).

The pre-commit hook, CI, and PR-template DO NOT enforce this — it's a culture norm, not a tooling check. Reasons:
- Tooling-enforced PR-body shape gets gamed (boilerplate filler).
- The reviewer is the last gate; they refuse to merge a PR whose success-criteria section is empty or generic.
- If we find ourselves repeatedly forgetting, *then* add a CI check.
