# ADR 0001 — Service-agnostic core

**Number:** 0001
**Date:** 2026-04-21
**Status:** accepted
**Supersedes:** —
**Superseded by:** —

## Context

Agent economy tooling is in flux. Payment rails (x402, AP2, Stripe MPP), agent frameworks (LangChain, CrewAI, LangGraph, Mastra), identity standards (W3C DID, IETF WIMSE), verification vendors (Sigstore, GitHub, DNS, Resend, X/Twitter) — each is a moving target. Foxbook will ship integrations with all of them in V1 and add more through V2/V3. If `core/` binds to any specific one, the wrong bet forces a rewrite.

Benjamin's prior product, DeskDuck, encoded this constraint as an architectural rule and it saved the product from several costly pivots. Foxbook carries that rule forward — one of the two pieces of DeskDuck knowledge reused — per `docs/foundation/foxbook-foundation.md` §17 and `docs/foundation/LOCKED.md`.

## Decision

**Files in the service-agnostic zones (`core/**` and `packages/**`) must contain zero references to specific payment rails, specific agent frameworks, specific third-party services, or specific capability names.**

Concrete rules (authoritative source: `core-isolation.config.json`):

1. Service-agnostic zones (`core/**`, `packages/**`) MUST NOT import from `adapters/**`.
2. Service-agnostic zones MUST NOT import any identifier in `bannedImports` (x402, ap2, coinbase, anthropic, openai, langchain, crewai, langgraph, mastra, @octokit/*, github, resend, sigstore, @sigstore/*, stripe, @stripe/*).
3. Service-agnostic zones MUST NOT contain string literals in `bannedCapabilityLiterals` (translation, summarization, transcription, embedding, classification, ocr, speech-to-text, text-to-speech).
4. Each `adapters/<name>/` CAN and SHOULD import `<name>`; that is the adapter's job. Adapters MUST NOT import sibling adapters' internals.
5. `packages/**` is part of the service-agnostic zone because it holds core-adjacent shared infrastructure (db schema, generated types, shield middleware core). If `packages/shared` reached for `x402`, `core` could transitively depend on `x402` through the permitted `core → packages/*` edge. Treating `packages/**` as service-agnostic closes that sneak path.

## Enforcement

The rule is enforced by `scripts/check-core-isolation.mjs`, invoked via:

- `pnpm check:core-isolation` at the CLI
- `.husky/pre-commit` on every local commit
- `.github/workflows/ci.yml` (node matrix job) on every push and PR

The checker is proven by permanent fixtures in `__fixtures__/core-isolation/`:

- Negative fixtures (must FAIL the checker):
  - `core-imports-adapter.ts` — core → adapters/* path
  - `core-imports-banned.ts` — core → banned identifier
  - `core-uses-capability-literal.ts` — core contains `"translation"` literal
  - `packages-imports-banned.ts` — packages → banned identifier (proves packages/** is service-agnostic too)
- Positive fixtures (must PASS the checker):
  - `adapter-imports-own-lib.ts` — `adapters/x402/` imports `x402`
  - `core-imports-packages.ts` — `core/` imports `@foxbook/packages/*`

Fixtures use an `@as-if-path` comment so they are evaluated as though they lived in their target zone. If a fixture's expected outcome flips, the checker reports a meta-failure and CI red-lights. The rule cannot silently drift without a fixture also drifting — and fixtures drifting shows up in review.

## Consequences

- **Adding a new integration = zero core changes.** Create `adapters/<new>/`, implement the integration there, expose a stable interface.
- **Cross-adapter composition** (e.g. `adapters/langchain-shield/` calling `adapters/x402/`) is not allowed at the adapter-code level. When composition is needed, introduce a shared primitive in `packages/**` and have both adapters depend on it (adapter → packages → adapter is allowed because the middle hop is service-agnostic).
- **Capability names are strings in config**, never in code. `capabilities.v1.json` (landing later) is the source of truth; `core/` dispatches by capability ID, not by `if (cap === "translation")`.
- **Drizzle lives in `packages/db/`**, not `core/db/`. Drizzle is not a service, but concentrating ORM concerns in `packages/*` keeps `core/` truly minimal.

## Alternatives considered

- **Interface-only `core/` with injection at the composition root.** Equivalent outcome but heavier ceremony. The ban list + structural check gets us the same guarantee without making every core function take a dependency bag.
- **Run-time discovery via a registry.** Fine for plugins at run time, but doesn't prevent compile-time imports. We want the check at the source-code level so PRs surface violations before CI ever runs.
- **Biome custom rule (GritQL) instead of a node script.** Biome's plugin system is real as of 2026-04 but still lacks granular per-rule disabling. A focused `scripts/check-core-isolation.mjs` is the safer choice for day 1; revisit if GritQL matures.

## When this rule can be violated

Only with an ADR that supersedes or amends this one, and with Benjamin's explicit sign-off. CODEOWNERS enforces this: `core-isolation.config.json` and the enforcement scripts are owned by `@cloakmaster`, so any change requires review.
