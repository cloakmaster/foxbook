# Security policy

## Reporting a vulnerability

Email **`hello@foxbook.dev`** with details. Do **not** open a public GitHub issue for security-sensitive findings.

Coordinated disclosure is preferred. Specific timelines are negotiable; aim for a fix-then-disclose window of 14–90 days depending on severity and exploitability.

If you don't get an acknowledgement within **7 days**, please re-send. Foxbook is in [stable / maintenance mode](docs/decisions/0008-stable-mode-maintenance-posture.md); maintainer attention is best-effort, but security reports are reviewed promptly.

## Scope

In scope:

- The protocol contract and reference implementation in this repository (Apache 2.0, see [`LICENSE`](LICENSE))
- The canonical reference deployments:
  - `https://transparency.foxbook.dev/` (transparency log read endpoints, RFC 9162-shaped)
  - `https://api.foxbook.dev/` (claim flow + by-handle lookup)
  - `https://foxbook.dev/` (project landing)
- The published SDK: `@foxbook/sdk-claim` on npm
- Cryptographic primitives in `core/src/crypto/` and the canonical-bytes implementation in `core/src/crypto/canonical.ts`
- The transparency log's signed tree head (STH) flow + recovery-key revocation flow

Out of scope:

- Forks under different names that run their own deployments. Report to the fork maintainer; the protocol contract is the only thing that crosses between forks.
- Third-party integrations that consume Foxbook (Concordia, Sanctuary Castle Architecture, AgentGraph, ArkForge, etc.) — report to the integrator. Foxbook can help triage if the issue is at the protocol boundary.
- Issues in dependencies (`@noble/curves`, `@noble/hashes`, `canonicalize`, etc.) — report upstream.
- Denial-of-service against the canonical reference deployments via routine load. The deployments are best-effort under stable mode (see [`docs/OPERATIONS.md`](docs/OPERATIONS.md)).

## What we consider security issues

The transparency log's integrity guarantees are load-bearing. Concretely, any of the following is a security issue:

- A claim that the log has produced two different leaf-byte sequences for the same `leaf_index` (log fork)
- A claim that the log's signed tree head has signed a root that doesn't match the tree's actual content
- A claim that revocation atomicity (per [ADR 0004 addendum-1](docs/decisions/0004-tl-leaf-schema-evolution.md)) has been violated — i.e., a window exists where the claim row is gone but the revocation leaf hasn't been appended (or vice versa)
- A claim that the canonical-bytes algorithm produces different bytes on the TS side vs. the Python side for the same input (cross-language byte-match break)
- A handle-spoof path that gets past `verifyAgentCard`'s `handle-mismatch` discriminator
- A signature-forgery path that gets past Ed25519 verification (extremely unlikely; would imply a defect in `@noble/curves`)
- Recovery-key compromise paths that don't require the recovery key itself
- Secret leakage paths in the deployed services (Fly.io secrets, Cloudflare Worker secrets, Neon connection strings)

Bugs that are NOT security issues but should still be reported (via normal GitHub issues):

- Test failures, build issues, documentation errors
- Performance regressions that don't break protocol guarantees
- API ergonomics, naming, type-shape concerns

## What you can expect from us

- Acknowledgement within 7 days
- A coordinated disclosure plan within 14 days of acknowledgement
- A fix or mitigation in the canonical reference deployment, plus a published advisory once disclosure is complete
- Credit in the advisory if you want it (and a clean attribution path if you don't)

## Cryptographic primitives + canonical bytes

If your finding is in cryptographic primitives, please include:

- Specific function or surface (e.g., `core/src/merkle/tree.ts:verifyInclusion`, `core/src/crypto/canonical.ts:canonicalize`)
- Reproduction (test vectors are at [`schemas/crypto-test-vectors.json`](schemas/crypto-test-vectors.json) and [`schemas/merkle-test-vectors.json`](schemas/merkle-test-vectors.json) — adding a failing case is the cleanest report)
- Impact assessment: which downstream guarantees break (inclusion-proof verification, STH validity, recovery-key revocation, etc.)

Cross-language byte-match is a load-bearing protocol guarantee. The continuous test of this is `pnpm check:generated` + the cross-language vectors in `schemas/`. A reproducible cross-language byte-match break is treated as a security issue.

## Apache 2.0 + trademark separation

The Apache 2.0 license + Foxbook trademark separation is documented in [`TRADEMARK.md`](TRADEMARK.md). Trademark-related concerns (e.g., a third party impersonating the canonical Foxbook reference impl under the Foxbook name) can be reported to the same `hello@foxbook.dev` address.

## Cross-references

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — what's welcome under stable mode
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — operational runbook including incident-response procedures
- [`docs/decisions/0004-tl-leaf-schema-evolution.md`](docs/decisions/0004-tl-leaf-schema-evolution.md) — revocation atomicity rules
- [`docs/decisions/0005-canonical-on-both-sides.md`](docs/decisions/0005-canonical-on-both-sides.md) — canonical-bytes algorithm
- [`docs/decisions/0008-stable-mode-maintenance-posture.md`](docs/decisions/0008-stable-mode-maintenance-posture.md) — stable-mode operational posture
