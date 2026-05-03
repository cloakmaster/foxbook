# ADR 0008 — Stable mode and maintenance posture

**Number:** 0008
**Date:** 2026-05-03
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0006 (protocol-not-marketplace)

## Context

Ten days of focused build closed with a clean three-PR sequence: PR #42 (firehose dispatch-stalled watchdog), PR #60 (tl-leaf v1.2 signing-key-registration shape via ADR 0004 addendum-3), PR #61 (SDK v0.2.0 with `verified_signing_key_hex` + structured `reason_code`). All public commitments from A2A Discussion #1803 are shipped. `@foxbook/sdk-claim@0.2.0` is on npm; `v0.2.0` is tagged on GitHub. The harness aggregator entry at `https://agentgraph.co/.well-known/interop-harness.json` registers Foxbook as `evidence_provider` on the identity-layer slot — the only implementation in the registry with `claim_type_layer: identity` set.

The honest measurement: 0 stars, 0 forks, 0 issues, 7 unique repo viewers in 14 days, 5 organic npm downloads on the day after launch (after 41 launch-day-spike downloads). No @-mentions of Foxbook in active cross-implementation threads. Public commitments shipped + cross-impl reference status registered + zero pull from outside.

This ADR ratifies the posture decision: **Foxbook enters stable / maintenance mode.** Feature work freezes; the substrate remains live; brand and operational continuity are protected so a future user discovering Foxbook in 6–24 months can adopt cleanly without the maintainer lifting a finger.

## Decision

### 1. Feature freeze

No new features. The protocol surface is the surface. Specifically:

- **No protocol shape / schema / canonicalization / leaf-format changes.** ADRs 0001–0007 are the contract.
- **No SDK API additions** beyond what `v0.2.0` ships. The six-function surface (`claimStart`, `claimVerifyGist`, `claimRevoke`, `verify`, `foxbookVerify`, `verifyAgentCard`) is the surface.
- **No new endpoints** on `api.foxbook.dev` or `transparency.foxbook.dev`. The current routes are the routes.
- **No new tools or integrations** (MCP server, CLI extras, Python SDK parity, etc.) — these were Day-9 retro candidates; under stable mode they are filed-not-actioned.

Spec-extension requests from cross-impl participants are noted in Discussion threads but not acted on. The reply pattern: "Stable mode; spec extension request noted." Forks under different names that extend the protocol are encouraged.

### 2. Substrate remains live

Live deployments stay live:

- `https://transparency.foxbook.dev/` — Cloudflare Worker, transparency log read endpoints (RFC 9162-shaped).
- `https://api.foxbook.dev/` — Fly.io, claim flow + by-handle lookup.
- `https://foxbook.dev/` — Cloudflare Pages, minimal stable-mode landing.
- `@foxbook/sdk-claim` on npm — pinned at the v0.2.x line.

Operational SLA is **best-effort**, not contractual. The OPERATIONS.md runbook (added under stable mode) documents how each service runs, monthly cost (target <$30/mo all-in), uptime monitoring, key rotation, and incident response — so the maintainer can recover from incidents in month 6 without rebuilding context.

Takedown requires 90-day notice via README. Archive of the GitHub repo is forbidden (loses discoverability + can't accept PRs).

### 3. Brand protection persists

Apache 2.0 license stays. Foxbook trademark stays per TRADEMARK.md. NOTICE file at repo root names the canonical implementation. The npm `@foxbook` scope is owned + locked at one package. The `github.com/foxbook` org is reserved for squat-prevention (the canonical repo remains at `cloakmaster/foxbook`).

These protections persist regardless of activity level. They protect the option to return to active development without rebuilding identity / namespace from scratch.

### 4. Future direction = TBD pending external integration signal

Stable mode is not abandonment. It's deferred decision pending external signal. The substrate continues to compound passively:

- Cross-impl reference cycle (harness aggregator entry, byte-match validation, kenneives litepaper §1.8 cross-reference at 2026-05-12) — these references continue to exist regardless of active development.
- A future regulatory forcing function (EU AI Act Article 12 audit-trail requirements, SR 11-7 model-risk management) may make the existing primitive load-bearing. ADR 0006 explicitly leaves the monetization-framing question open as a future ADR.
- A future external integrator (ArkForge enforcement-gateway, AEP composability layer, a regulated AI vendor needing audit trails) may exercise the existing surface and create pull.

In any of these cases, the path back to active development runs through a new ADR (likely 0009+) that explicitly supersedes the freeze in this ADR. The substrate keeps the option open; the freeze closes the cost of maintaining velocity.

## Enforcement

- **Code review.** Any PR that adds features (new endpoints, new SDK functions, new schema shapes, new tools) must reference this ADR in the body and justify why the freeze is being lifted. The default answer is no.
- **Discussion / outreach replies** route feature-flavored asks back to "Stable mode; spec extension request noted." Forks under different names are welcomed in the same reply.
- **The plan at `/Users/tester/.claude/plans/focus-deeply-and-use-nifty-swan.md`** is the source-of-truth for what's frozen, what's preserved, and what the explicit re-entry conditions are. Future-maintainer reads that first.
- **No CI cron jobs that auto-iterate.** Existing CI runs only on push/PR; the deploy workflow is tag-gated. These remain safe under stable mode.

## Consequences

- The maintainer's marginal forward hour is allocated elsewhere. Foxbook receives reactive maintenance only (incident response, security issues, dependency security updates if needed).
- PRs from external contributors are welcomed but review may take weeks — documented in CONTRIBUTING.md.
- Discoverability path for a future user: harness aggregator entry → repo → README → `docs/RATIONALE.md` (the narrative summary) → `docs/VERIFY-IN-60-SECONDS.md` (the live demo) → `npm i @foxbook/sdk-claim` → integration. Email `hello@foxbook.dev` for production support contact.
- Cross-impl reference cycle compounds at protocol-half-life pace (years) rather than weekly-iteration pace. This is a feature, not a bug, per ADR 0006.

## Alternatives considered

- **Continue active development at lower cadence.** Rejected: half-effort active development looks worse than stable maintenance — repos with stale "in progress" notes signal abandonment more than repos with explicit Stable status.
- **Archive the GitHub repo.** Rejected per the constraint above. Archived repos lose discoverability and can't accept PRs; the harness aggregator points at a live repo, not an archive.
- **Take down the live deployments.** Rejected: the SDK depends on them; cross-impl references depend on them; a takedown without 90-day notice would burn credibility for any future return.
- **Relicense from Apache 2.0** (e.g., to AGPL or a proprietary license). Rejected: relicensing the code would break ADR 0006's protocol-not-marketplace stance + harness aggregator positioning + community trust.
- **Public "I'm pivoting away" announcement.** Rejected: stable-mode framing is honest about the current state without burning the future option. The inner state is private; the public face is "stable maintained primitive."

## When this rule can be violated

Only via an ADR that supersedes 0008. Concrete scenarios that would warrant a new ADR:

1. **External integration signal materializes.** A vendor / regulator / spec body cites Foxbook by name as a load-bearing dependency. A new ADR documents the signal + lifts the freeze proportionally to the signal.
2. **Regulatory forcing function lands.** EU AI Act Article 12 (or similar) takes effect and Foxbook's transparency-log primitive maps cleanly to a compliance requirement. A new ADR may add compliance-targeted features (audit-trail dashboards, regulator-readable export formats) under that motivation.
3. **A future maintainer takes over.** Stable mode preserves the brand + namespace + canonical impl pointer; a hand-off via TRADEMARK.md + NOTICE conveys the canonical role. The new maintainer's first ADR documents the transition.
4. **The original maintainer resumes active development.** Same path — a new ADR documents the resumption + explicit re-entry conditions.

## Verified

- Phase 1 of the stable-mode plan (public commitments shipped) verified at:
  - PR #42 (`94f04c0`): firehose dispatch-stalled watchdog
  - PR #60 (`982804c`): tl-leaf v1.2 signing-key-registration via ADR 0004 addendum-3
  - PR #61 (`495c694`): SDK v0.2.0
  - npm registry: `@foxbook/sdk-claim@0.2.0` (shasum `b92ad3d2…`)
  - GitHub release: `v0.2.0` tagged 2026-05-03
- This ADR's date (2026-05-03) matches the Phase 1 close. The freeze starts on the day the public commitments closed.
- Phase 2–5 of the stable-mode plan land progressively after this ADR; each phase's exit criteria are documented in the plan file and in the corresponding PR body.
