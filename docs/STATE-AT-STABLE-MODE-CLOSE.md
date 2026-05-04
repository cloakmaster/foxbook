# State of Foxbook at stable-mode close

**Snapshot date**: 2026-05-04
**Status**: Stable / maintenance mode per [ADR 0008](decisions/0008-stable-mode-maintenance-posture.md)
**Maintainer**: Benjamin Bandali ([@cloakmaster](https://github.com/cloakmaster))

This page is the factual snapshot of what shipped, what's running, and what's documented as of the stable-mode close. Future-you (or a future maintainer arriving cold) reads this first.

---

## Shipped artifacts

### Code + spec

| Surface | Version | Where |
|---|---|---|
| TypeScript SDK | `@foxbook/sdk-claim@0.2.1` | <https://www.npmjs.com/package/@foxbook/sdk-claim> |
| Transparency log read endpoints (RFC 9162-shaped) | `1.0` | <https://transparency.foxbook.dev/> |
| Claim flow API | `v1` | <https://api.foxbook.dev/api/v1/...> |
| Service-discovery surface | `protocol_version: 1.0` | <https://api.foxbook.dev/.well-known/foxbook.json> |
| AgentCard extension schema | `x-foxbook v1` | [`schemas/x-foxbook.v1.json`](../schemas/x-foxbook.v1.json) |
| Transparency-log leaf taxonomy | `tl-leaf v1.2` | [`schemas/tl-leaf.v1.json`](../schemas/tl-leaf.v1.json) — `agent-key-registration`, `revocation`, `signing-key-registration` |
| Cross-language test vectors | live | [`schemas/crypto-test-vectors.json`](../schemas/crypto-test-vectors.json) + [`schemas/merkle-test-vectors.json`](../schemas/merkle-test-vectors.json) |
| Byte-match validation report | CTEF v0.3.1, 4/4 vectors | [`ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md`](../ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md) (commit 9e392c5) |

### Architecture decision records (ADRs)

| ADR | Title | Status |
|---|---|---|
| [0001](decisions/0001-service-agnostic-core.md) | Service-agnostic core | Accepted |
| [0002](decisions/0002-db-layer-discipline.md) | Database layer discipline | Accepted |
| [0003](decisions/0003-foxbook-enums-as-schemas.md) | Foxbook-specific enums in JSON schemas | Accepted |
| [0004](decisions/0004-tl-leaf-schema-evolution.md) | tl-leaf schema evolution + revocation atomicity (3 addenda) | Accepted |
| [0005](decisions/0005-canonical-on-both-sides.md) | Canonical hashing on raw objects | Accepted |
| [0006](decisions/0006-protocol-not-marketplace.md) | Protocol-not-marketplace + co-option failure mode | Accepted (retroactive, ratified 2026-04-26) |
| [0007](decisions/0007-http-cache-and-read-write-split.md) | HTTP cache policy + read/write split | Accepted |
| [0008](decisions/0008-stable-mode-maintenance-posture.md) | Stable mode and maintenance posture | Accepted |
| [0009](decisions/0009-typed-reference-schema-for-composition.md) | Typed-reference schema for composition | Under public discussion |

ADR 0009 ratifies in-place once the schema thread reaches consensus (no separate 0010 for ratification).

### Cross-implementation reference status

Per [ADR 0006](decisions/0006-protocol-not-marketplace.md) §4, named cross-impl references are the load-bearing co-option-defense indicator. Current state:

- **Harness aggregator entry**: registered at <https://agentgraph.co/.well-known/interop-harness.json> as `evidence_provider` on the `claim_type_layer: identity` slot. Foxbook is the only implementation in the registry with `claim_type_layer: identity` set.
- **CTEF v0.3.1 byte-match**: 4/4 SHA-256-exact vectors against `agentgraph-co/agentgraph@69ad94d` (commit `9e392c5`). Cited in the harness aggregator entry's `inline_vector_byte_match` field.
- **AgentGraph litepaper §1.8**: substrate-and-primitive-layering framing, publishing 2026-05-12. Cross-references Foxbook implicitly via the harness aggregator entry.

### Active integrations

See [`docs/INTEGRATIONS.md`](INTEGRATIONS.md). Current entries:

- **Concordia v0.4.0 + Sanctuary Castle v1.2** (eriknewton) — typed-reference composition. Status: Proposed; schema discussion at [https://github.com/cloakmaster/foxbook/discussions/73](https://github.com/cloakmaster/foxbook/discussions). ADR 0009 ratifies the agreed shape on the Foxbook side once consensus lands.

---

## Live infrastructure

| Service | URL | Provider | Estimated monthly cost |
|---|---|---|---|
| Project landing | <https://foxbook.dev/> | Cloudflare Pages (free tier) | $0 |
| Transparency log read endpoints | <https://transparency.foxbook.dev/> | Cloudflare Workers (free tier) | $0 |
| Claim flow API + by-handle lookup | <https://api.foxbook.dev/> | Fly.io (`shared-cpu-1x`, 256MB, fra region) | ~$2-5 |
| Postgres | (internal binding) | Neon (tier varies — confirm in dashboard) | $0-19 |
| DNS / domain | foxbook.dev | Namecheap (.dev TLD, ~$15/yr) | ~$1.25 amortized |
| Email Routing | `*@foxbook.dev` → maintainer's primary inbox | Cloudflare (free) | $0 |
| Uptime monitoring | GitHub Actions cron @ 15-min interval | GitHub Actions (free tier) | $0 |

**Total estimate**: $3-25/month all-in. Target <$30/month per [`OPERATIONS.md`](OPERATIONS.md). Operational SLA is best-effort under stable mode.

For the full operations runbook (re-deploy, key rotation, incident response, backups, monitoring), see [`OPERATIONS.md`](OPERATIONS.md).

---

## Documentation surface

For someone arriving cold:

1. [`README.md`](../README.md) — 60-second pitch + quickstart + Status section
2. [`docs/RATIONALE.md`](RATIONALE.md) — narrative summary of why Foxbook is shaped the way it is (covers all 9 ADRs)
3. [`docs/VERIFY-IN-60-SECONDS.md`](VERIFY-IN-60-SECONDS.md) — verify a live agent card from a fresh shell
4. [`docs/COMPOSE-WITH-FOXBOOK.md`](COMPOSE-WITH-FOXBOOK.md) — engagement path for new integrators
5. [`docs/INTEGRATIONS.md`](INTEGRATIONS.md) — catalog of active compositions
6. [`docs/OPERATIONS.md`](OPERATIONS.md) — operations runbook
7. [`docs/decisions/`](decisions/) — full ADRs 0001–0009
8. [`docs/rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md) — the spec in RFC form
9. [`TRADEMARK.md`](../TRADEMARK.md) — name + license split rationale
10. [`CONTRIBUTING.md`](../CONTRIBUTING.md) — what's welcome, what's not under stable mode
11. [`NOTICE`](../NOTICE) — Apache 2.0 attribution + canonical impl pointer

---

## Contact

- **`hello@foxbook.dev`** — substantive engagement, integration spec sessions, security disclosures, production support inquiries
- **GitHub Discussions** in `cloakmaster/foxbook` — public spec threads
- **GitHub Issues** in `cloakmaster/foxbook` — bugs, feature requests (noted but not actioned under stable mode), uptime incidents (auto-opened by the workflow on detected downtime)

Review timing under stable mode: weeks, not days. Security issues are reviewed promptly.

---

## What's deliberately frozen

Per [ADR 0008](decisions/0008-stable-mode-maintenance-posture.md):

- New protocol shape / schema / canonicalization / leaf-format changes
- New SDK API additions beyond v0.2's six-function surface
- New endpoints on `api.foxbook.dev` or `transparency.foxbook.dev`
- New tools or integrations (MCP server, CLI extras, additional language SDKs)
- Active feature roadmap

Forks under different names that extend the protocol are welcome (see [TRADEMARK.md](../TRADEMARK.md)). Composition against Foxbook's existing surface is welcome and tracked at [`INTEGRATIONS.md`](INTEGRATIONS.md).

---

## When this rule can be violated

Stable mode is exited via a future ADR that explicitly supersedes 0008. Concrete trigger scenarios documented in ADR 0008:

1. External integration signal materializes — vendor / regulator / spec body cites Foxbook by name as a load-bearing dependency.
2. Regulatory forcing function lands — EU AI Act Article 12 (or similar) takes effect and Foxbook's transparency-log primitive maps cleanly to a compliance requirement.
3. A future maintainer takes over — hand-off via TRADEMARK.md + NOTICE conveys the canonical role.
4. The original maintainer resumes active development.

In all four cases, a new ADR documents the resumption + explicit re-entry conditions.

---

## Changelog of stable-mode close

For the sequence of PRs that brought Foxbook to this state, see `git log` from 2026-05-03 onwards. Notable landmarks:

- **2026-05-03**: Phase 1 commitments shipped — PR #42 (firehose watchdog), #60 (tl-leaf v1.2 rotation shape), #61 (SDK v0.2.0). npm publish + GitHub release v0.2.0.
- **2026-05-03**: Phase 2 docs lockdown — PR #62 (CONTRIBUTING, NOTICE, RATIONALE, VERIFY-IN-60-SECONDS, ADRs 0006 + 0008, README Status edits) + PR #63 (consolidate to `hello@foxbook.dev`).
- **2026-05-04**: Phase 4 ops runbook — PR #64 (OPERATIONS.md + uptime workflow + env-vars cleanup) + PR #66 (defer landing probe) + PR #67 (firehose listener test flake fix).
- **2026-05-04**: Stable-mode close — PRs B / C / D / E (this snapshot, INTEGRATIONS / COMPOSE-WITH-FOXBOOK / ADR 0009 placeholder / landing page / v0.2.1 doc-bump / final Discussion update).
