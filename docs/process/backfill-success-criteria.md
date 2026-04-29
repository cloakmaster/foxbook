# Backfill — Success criteria for merged PRs #29 / #36 / #37 / #38

Per [`pr-success-criteria.md`](pr-success-criteria.md), every PR body should include a `## Success criteria` section. Four merged PRs shipped before that standard was filed. Below are the proposed retroactive paragraphs for each — review here, then run `gh pr edit` to apply.

> **Filing discipline:** editing already-merged PR bodies is a public-history annotation. It's reviewable in advance (this file). Per [`feedback_external_actions_require_explicit_go.md`](../../../.claude/projects/-Users-tester-foxbook-port/memory/feedback_external_actions_require_explicit_go.md), Benjamin's explicit "go" is needed before any `gh pr edit` runs against PRs visible in the public repo's commit history.

For each PR, the backfill paragraph appends to the existing PR body under a new `## Success criteria (backfilled 2026-04-28)` heading — the original PR-body content is preserved verbatim, the section is additive.

---

## PR #29 — `[draft-spec] PR B — revocation harness (Day-6 design gate)` (merged 2026-04-26)

**Proposed backfill:**

```markdown
## Success criteria (backfilled 2026-04-28)

A scout consuming the Foxbook transparency log observes a `revocation` leaf at index N+1 within seconds of an agent's `recovery_key`-signed revocation POST, and any subsequent claim attempting to bind the revoked `(asset_type, asset_value)` succeeds with a fresh keypair (delete-on-revoke per ADR 0004 addendum-1). Day-6 verification: `pnpm --filter apps/api smoke:revoke` against live Neon dev produces all six assertions including wall-clock <500ms — captured at `ops/bench-results/2026-04-26-first-live-revocation.txt` (467ms wall-clock).
```

**Apply:** `gh pr edit 29 --body "$(gh pr view 29 --json body -q .body)\n\n## Success criteria (backfilled 2026-04-28)\n\n[paragraph above]"`

---

## PR #36 — `feat: PR D — minimal firehose (Day-7 implementation)` (merged 2026-04-27)

**Proposed backfill:**

```markdown
## Success criteria (backfilled 2026-04-28)

A scout running `bash scripts/firehose-tail.sh` against `https://api.foxbook.dev/firehose` (or local dev at `http://localhost:8787/firehose`) receives a `claim.verified` SSE event within 100ms wall-clock of a separate terminal completing `pnpm smoke:tier1`. Day-7 verification: the live end-to-end smoke ran post-Migration-0004 with median DB-COMMIT → SSE-receive latency of 20ms across 5 trigger-driven inserts + 1 reconnect-proof event — captured at `ops/bench-results/2026-04-27-firehose-latency.csv` (PR #40).
```

**Apply:** `gh pr edit 36 --body "..."` as above.

---

## PR #37 — `feat: PR C — Tier 2 DNS TXT + endpoint-challenge verification` (merged 2026-04-27)

**Proposed backfill:**

```markdown
## Success criteria (backfilled 2026-04-28)

A developer claiming a domain (e.g., `acme.example`) via Foxbook publishes a TXT record at `_foxbook-claim.acme.example` containing `foxbook-verification=<code>`, calls `POST /api/v1/claim/verify-dns`, and receives `{tier: 2}` within ~10s — OR registers an endpoint-challenge URL, calls `POST /api/v1/claim/verify-endpoint`, and the verifier round-trips an Ed25519 signed nonce with `match` status. Eight discriminated DNS statuses (NXDOMAIN / SERVFAIL / TC / 429 / timeout / still-pending / identity-mismatch / match) surface to the operator distinctly — none collapse to `error` — so retry policy is decisionable. Week-2 verification: manual smoke against a Foxbook-controlled domain produces a tier2 transition end-to-end.
```

**Apply:** `gh pr edit 37 --body "..."` as above.

---

## PR #38 — `feat: PR E — Week-2 Distribution Track quartet` (merged 2026-04-27)

**Proposed backfill:**

```markdown
## Success criteria (backfilled 2026-04-28)

The Week-2 leading indicator from PROJECT-PLAN.md fires: 10 named external targets (per `docs/outreach.md`) successfully run verification against the live Foxbook transparency log within 5 minutes of receiving the DM, with zero follow-up Q&A. Tracked per-target via the `verifier_run` column. End-of-week-2 verification: count the `verifier_run = ☑` cells in `outreach.md`. <10 of 10 = framing isn't carrying its weight; pivot before scaling. Note: the SDK + RFC + outreach roster shipped here are *artifacts in service of* this metric — engineering completeness is necessary; it's not the success criterion. The success criterion is human action, downstream of the artifacts.
```

**Apply:** `gh pr edit 38 --body "..."` as above.

---

## After Benjamin reviews + says go

For each PR, capture current body + append section + push:

```bash
for pr in 29 36 37 38; do
  current_body=$(gh pr view $pr --json body -q .body)
  paragraph=$(awk -v p="PR #$pr" '/^## PR #'$pr'/,/^---$/' docs/process/backfill-success-criteria.md \
    | sed -n '/```markdown$/,/```$/p' | sed '1d;$d')
  printf '%s\n\n%s\n' "$current_body" "$paragraph" > /tmp/body-$pr.md
  gh pr edit $pr --body-file /tmp/body-$pr.md
done
```

(That awk/sed extract is approximate — verify the paragraph content per PR before running.)

The action is reversible if the framing drifts (re-edit a PR body), but the public-record annotation is the durable artifact. Keep this file in `docs/process/` as the canonical paragraph source — if the success criterion ever needs revisiting (e.g., the Week-2 leading indicator's threshold changes from 10/10 to a different number), update here + edit the PR body again.

---

## Filed for future PRs

The standard at [`docs/process/pr-success-criteria.md`](pr-success-criteria.md) kicks in for every PR going forward (Day-8+). The reviewer (Benjamin or Claude Code) refuses to merge a PR whose success-criteria section is empty or generic ("tests pass"). The backfill above brings the four pre-standard PRs up to par; the standard prevents recurrence.
