# ADR 0003 — Foxbook-specific enums live in JSON schemas, not generated types

**Number:** 0003
**Date:** 2026-04-23
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0001 (service-agnostic core), ADR 0002 (DB layer discipline)

## Context

Day 5 landed `schemas/capabilities.v1.json` — a JSON Schema pinning 22 Foxbook-specific capability IDs (`text-generation`, `code-generation`, `text-translation`, `audio-transcription`, …) and validator surface (`validateCapability`, `getCapabilityIds`) in `@foxbook/validators`. The kickoff prompt aspirationally scoped `generate-types.mjs` to grow to **10** generated files (adding TS + Python enum types for capabilities to the existing 8). That did not ship; `check:generated` stays at 8 files, and PR #14 documented why.

This ADR pins the reason as a durable architectural rule so future-us doesn't re-derive it at the 23rd capability, 4th verification tier, 5th tl-leaf type, or 6th envelope event type.

**Two forces collide:**

1. **`core-isolation.config.json` bans specific capability literals** (`translation`, `summarization`, `transcription`, `embedding`, `classification`, `ocr`, `speech-to-text`, `text-to-speech`) from appearing as quoted strings in `core/**` and `packages/**`. The rule enforces the service-agnostic-core discipline from ADR 0001 — core can't know about specific capability concepts as first-class concerns.

2. **`json-schema-to-typescript` emits enum values as TS string literal unions** (`type CapabilityId = "text-generation" | "translation" | …`). `quicktype` does the equivalent for Python. These generated files live under `packages/types-ts/src/` and `packages/types-py/src/foxbook_types/` — both inside the service-agnostic zone.

The capability taxonomy uses compound forms (`text-translation`, `audio-transcription`, …) that **structurally avoid the regex check** (the regex requires the banned literal to be bounded by quotes on both sides). But this is a coincidence of the Day-5 taxonomy, not a guarantee: a future capability named exactly `"translation"` — which is a reasonable ID — would trip the check via generated output even though the source schema is fine.

## Decision

**Foxbook-specific enum taxonomies (capabilities, verification-tier codes, tl-leaf types, envelope event types, claim states, payment rails) ship as JSON Schema files in `schemas/*.json`. We do NOT generate TS or Python enum types from them into `packages/types-ts/` or `packages/types-py/`.**

Consumers:
- Type these fields as `string` in TS and Python.
- Validate at runtime via `@foxbook/validators` (AJV-compiled) or the Python equivalent.
- Retrieve the current enum set via a validators-surface accessor (e.g. `getCapabilityIds()`) when they need to branch or enumerate.

**Wire-shape schemas still get full type generation.** `envelope/v1.json`, `agent-card.v1.json`, `x-foxbook.v1.json`, `discover-response.v1.json` ship TS + Python types because their consumers (scouts, SDKs, downstream A2A clients) need compile-time shape safety. What's different about wire-shape vs. taxonomy-enum:

| Schema kind | Example | Type-generated? | Why |
|---|---|---|---|
| Wire shape | envelope, agent-card, x-foxbook | Yes | Consumers construct / parse at compile time; shape drift is a breaking change. |
| Taxonomy enum | capabilities, tl-leaf types, event types | **No** | Values are open-set to consumers; generated enum literals would leak into service-agnostic zones. Runtime validation is the right seam. |

**Heuristic for future schemas:** if the schema's top-level is an object with named fields (`envelope` has `event_id` / `event_type` / `payment` / …), generate types. If the schema's top-level is an enum (`capabilities` has `capability_id` drawn from one of 22), don't — validate at runtime.

## Enforcement

- `scripts/generate-types.mjs` carries an explicit list of schemas to generate. New taxonomy-enum schemas are NOT added to the list; their reviewer checks that the validator surface exists in `@foxbook/validators` instead.
- `scripts/check-generated.mjs` validates the same set — if someone adds a taxonomy-enum schema to the generator list, the drift check catches it.
- `schemas/capabilities.v1.json`'s `description` field references this ADR.
- `@foxbook/validators`'s README (future — filed) names the pattern: "Foxbook-specific enums use `validateX(id) → boolean` + `getXIds() → string[]`. Consumers use `string` types."

## Consequences

- Consumers lose compile-time safety on capability / tier / leaf-type IDs. They pay for this at runtime via the validator.
- External SDKs (future Python / TypeScript SDK for third-party agent developers) may want compile-time safety eventually. When that lands, those SDKs generate their own enum types from the schema locally — the rule above applies to `packages/types-ts` and `packages/types-py`, not to external SDK packages outside the service-agnostic zone.
- Adding the 23rd capability: update `schemas/capabilities.v1.json`'s enum, update `@foxbook/validators` tests, done. No generated-type churn across 22 workspaces.
- Banning a previously-allowed capability (or breaking its shape): v2 schema, deprecation window. This is the same discipline as ADR 0004 (tl-leaf evolution).

## Alternatives considered

- **Generate types but exempt the output from `check-core-isolation.mjs`.** Rejected: the exemption would narrow the rule that made the ADR-0001 lint effective on day 1. Banned literals in generated files is the same risk as banned literals in hand-written files — a reader looking up "where does 'translation' appear in the codebase" sees both equally.

- **Rename all capabilities to compound forms forever (e.g. `text-translation`, `text-summarization`) and always generate types.** Rejected: coincidence of today's taxonomy, not a rule. A future `"encryption"` or `"billing"` capability wouldn't trip the ban list but a future `"ocr"` or `"tts"` might. The ADR pins the shape, not the naming workaround.

- **Keep the ban list to a smaller set that couldn't arise naturally.** Rejected: the ban list is load-bearing per ADR 0001's DeskDuck-lineage argument. Shrinking it weakens the core-isolation guarantee.

## When this rule can be violated

Only via an ADR that supersedes 0003. Specific cases we'd consider:

1. A TypeScript SDK package published externally for agent developers — generates its own enum locally from the schema; does not live in `packages/types-ts/`.
2. A capability taxonomy explicitly declared "closed" in a future V2 (unlikely — V1 committed to openness).

## Verified

- `schemas/capabilities.v1.json` ships as JSON Schema + validator surface (PR #14).
- `check:generated` passes at 8 files, not 10 (PR #14).
- `packages/validators` exposes `validateCapability` + `getCapabilityIds`; no TS enum type for `CapabilityId` exists.
