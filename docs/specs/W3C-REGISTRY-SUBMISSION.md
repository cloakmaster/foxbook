# W3C DID Method Registry — Submission Runbook for `did:foxbook`

**Audience**: Benjamin (or whoever holds the `@cloakmaster` identity), executing the W3C registry submission.
**Estimated time**: 30-60 minutes from clean state. Mostly waiting for the W3C process to acknowledge.
**Status**: ready to execute when Benjamin chooses to file. No external deadline; this is a durable substrate-position artifact.

---

## Why this submission matters

`did:foxbook` is currently cited as an "alternative DID method" in:
- CTEF v0.3.2 substrate-and-primitive layering figure (Layer 2 primitive) — at `agentgraph-co/agentgraph/docs/standards/v0.3.2-layering-figure.md`
- State of Agent Security — Q2 2026 (AgentGraph) — §3.8 byte-match table + §4 Partners + §4 Co-signer Perspectives byline

Both citations reference `did:foxbook:` without a corresponding W3C DID method registry entry. **Registering closes the credibility gap a hostile reviewer could exploit** — the W3C DID method registry is the canonical directory; being in it = legitimate DID method, citable in IETF/W3C contexts. Once registered, the substrate position holds independent of any single ecosystem player.

The submission is **doc-only** (no protocol change, no implementation change). It documents existing behavior; it does not propose new functionality. Fits stable-mode discipline per ADR 0008.

---

## Pre-submission checklist

Run through these before opening the W3C PR:

- [ ] The specification document exists at [`docs/specs/did-foxbook-method.md`](did-foxbook-method.md) on `main` and is reachable at the public URL `https://github.com/cloakmaster/foxbook/blob/main/docs/specs/did-foxbook-method.md`
- [ ] The reference implementation is publicly available at `https://github.com/cloakmaster/foxbook` (Apache 2.0)
- [ ] The reference deployment is operational: `curl -s https://transparency.foxbook.dev/root | jq` returns a valid STH
- [ ] The npm-published SDK is reachable: `npm view @foxbook/sdk-claim` shows a published version
- [ ] At least one resolvable example DID exists in production (a `did:foxbook:` that returns a valid DID Document via `https://api.foxbook.dev/agents/<did>`). Optional but strengthens the submission.
- [ ] The Foxbook trademark posture is documented at [`TRADEMARK.md`](../../TRADEMARK.md) (W3C wants to know naming control)

---

## Step 1 — Fork the W3C DID Specification Registries repo

The canonical registry source is at: https://github.com/w3c/did-spec-registries

```bash
# In a fresh working directory
gh repo fork w3c/did-spec-registries --clone --remote
cd did-spec-registries
git checkout -b add-did-foxbook
```

This creates a fork under `cloakmaster/did-spec-registries` and a working branch `add-did-foxbook`.

---

## Step 2 — Locate the DID methods file

The DID methods are tracked in a structured data file. As of 2026-05-15, the canonical location is:

```
methods/foxbook.md
```

(verify against the repo structure at submission time — W3C has occasionally reorganized; the README of the registry repo names the current location).

If the file structure is `methods.json` instead, locate the JSON entry. The instructions below assume the current per-method Markdown file structure (`methods/<method-name>.md`); adapt if W3C has changed conventions.

---

## Step 3 — Create the method entry

Create `methods/foxbook.md` with the following content (this is the W3C-registry-formatted entry, not the full spec — the spec is linked from here):

```markdown
# foxbook

## Method Name

foxbook

## Method Specification URL

https://github.com/cloakmaster/foxbook/blob/main/docs/specs/did-foxbook-method.md

## Method-Specific Identifier

`did:foxbook:<ulid>` where `<ulid>` is a 26-character ULID in Crockford's Base32 (uppercase).

Format regex: `^did:foxbook:[0-7][0-9A-HJKMNP-TV-Z]{25}$`

## Method Status

Provisional (single canonical reference deployment; protocol contract is multi-deployment compatible)

## Network

n/a (operates over HTTPS against an RFC 9162-shaped public transparency log; not anchored to a cryptocurrency or blockchain network)

## Contact

Benjamin Bandali — https://github.com/cloakmaster — hello@foxbook.dev

## Source Code

https://github.com/cloakmaster/foxbook (Apache 2.0)

## Registry

n/a — single canonical reference deployment at `transparency.foxbook.dev`; protocol supports federation but currently single-operator

## Conformance Test Suite

- Cross-language byte-match test vectors at https://github.com/cloakmaster/foxbook/blob/main/schemas/crypto-test-vectors.json
- Merkle inclusion-proof test vectors at https://github.com/cloakmaster/foxbook/blob/main/schemas/merkle-test-vectors.json
- Independent canonicalizer cross-validation at https://github.com/cloakmaster/foxbook/blob/main/tools/cross-validate-rfc8785/README.md

## DID Documents Storage

Off-chain — DID Documents are computed from the current state of the transparency log at resolution time. The log itself is the storage; the DID Document is a projection. Inclusion proofs and signed tree heads allow any third party to independently verify the projection.

## Other Specifications Referenced

- RFC 9162 (Certificate Transparency v2.0) — transparency log shape
- RFC 8785 (JSON Canonicalization Scheme) — canonicalization
- RFC 8032 (EdDSA) — Ed25519 signatures
- ULID specification (https://github.com/ulid/spec)
- W3C DID Core 1.0
- W3C Ed25519VerificationKey2020
```

Adjust the exact field structure to match the current W3C registry template (check by reading 2-3 existing method files like `methods/web.md`, `methods/key.md`, `methods/plc.md`).

---

## Step 4 — Commit and push

```bash
git add methods/foxbook.md
git commit -m "feat(methods): add did:foxbook DID method entry

Foxbook is a W3C DID method anchored by an RFC 9162-shaped public
Merkle transparency log. The method addresses verifiable agent identity
in A2A and MCP ecosystems with atomic revocation and recovery/signing
key separation.

Method specification: https://github.com/cloakmaster/foxbook/blob/main/docs/specs/did-foxbook-method.md
Reference implementation: https://github.com/cloakmaster/foxbook (Apache 2.0)
Canonical deployment: https://transparency.foxbook.dev"

git push origin add-did-foxbook
```

---

## Step 5 — Open the W3C pull request

```bash
gh pr create --repo w3c/did-spec-registries --title "Add did:foxbook DID method" --body "$(cat <<'EOF'
## Summary

Adds `did:foxbook` to the DID method registry. Foxbook is a DID method anchored by an RFC 9162-shaped public Merkle transparency log, addressing verifiable agent identity in A2A and MCP ecosystems.

## Method specification

https://github.com/cloakmaster/foxbook/blob/main/docs/specs/did-foxbook-method.md

## Key properties

- **Method-Specific Identifier**: `did:foxbook:<ulid>` where `<ulid>` is a 26-character ULID in Crockford's Base32 (uppercase).
- **Substrate**: Public, append-only, RFC 9162-shaped Merkle transparency log. Single canonical reference deployment at `transparency.foxbook.dev`; protocol contract is multi-deployment compatible.
- **Cryptography**: Ed25519 signing + recovery keys (separate); JCS (RFC 8785) canonicalization.
- **Atomic revocation**: revocation appends a leaf to the log + deletes the current claim row in a single transaction (per ADR 0004 addendum-1 in the reference implementation). Past inclusion proofs verify forever.
- **Recovery / signing key separation**: a leaked recovery key permits denial-of-service (revoke + re-claim) but not impersonation; a leaked signing key permits impersonation only until revocation.

## Reference implementation

- Repository: https://github.com/cloakmaster/foxbook (Apache 2.0)
- SDK: `@foxbook/sdk-claim` on npm
- Canonicalization: `canonicalize@2.1.0` (erdtman RFC 8785 reference impl)
- Live deployment: https://transparency.foxbook.dev

## Cross-implementation validation

- Cross-language byte-match test vectors: `schemas/crypto-test-vectors.json` + `schemas/merkle-test-vectors.json`
- Independent canonicalizer cross-validation against `trailofbits/rfc8785.py` documented in `tools/cross-validate-rfc8785/`
- Cited as Layer 2 identity primitive (alternative DID method) in:
  - CTEF v0.3.2 substrate-and-primitive layering figure (`agentgraph-co/agentgraph`)
  - State of Agent Security — Q2 2026 (AgentGraph), §3.8 + §4 + co-signer byline

## Trademark posture

The Foxbook trademark is held by Benjamin Bandali. The DID method specification, the reference implementation, and the protocol contracts are Apache 2.0. The trademark is separate (see https://github.com/cloakmaster/foxbook/blob/main/TRADEMARK.md). Nominative use in DID method registry contexts is explicitly permitted.

## Contact

Benjamin Bandali — https://github.com/cloakmaster — hello@foxbook.dev
EOF
)"
```

---

## Step 6 — Wait for review

W3C registry PRs are typically reviewed by W3C DID Working Group members within 2-4 weeks. The reviewer may ask for clarifications. Respond promptly; the reviewer's job is to verify:

- The method is well-defined (the linked spec is comprehensive)
- The method name doesn't collide with an existing entry
- The method has a public reference implementation
- The method is operationally real (the spec describes shipped functionality, not aspirational design)

All four points are true for `did:foxbook`. Any review feedback typically requests minor wording changes or additional cross-references; address inline and request re-review.

---

## Step 7 — After merge

Once the W3C PR is merged:

1. Add a one-line note to [`docs/RATIONALE.md`](../RATIONALE.md) under the "Substrate citations" section pointing at the W3C registry entry.
2. Update [`README.md`](../../README.md) to mention W3C DID method registry inclusion if appropriate.
3. Add a memory entry capturing the registration date + PR URL.
4. Mention in the next bundled doc PR (or stand-alone) but no need for a public announcement under stable-mode posture.

---

## Failure mode considerations

**If W3C rejects the submission**: rare for well-documented methods with operational deployments. Likely causes would be (a) method name collision (none expected — `foxbook` is not a registered method name as of 2026-05-15) or (b) insufficient specification detail (the linked spec is comprehensive). Address feedback iteratively.

**If W3C process changes**: W3C occasionally reorganizes the registry. Check the registry repo README for current submission conventions before opening the PR.

**If the canonical deployment goes offline**: the W3C registry entry references the spec document (in the Foxbook repo) and the source code (Apache 2.0). Operational availability of `transparency.foxbook.dev` is not a hard prerequisite — the spec describes the protocol; any operator can run a conforming deployment.

---

## Cross-references

- The DID method specification: [`docs/specs/did-foxbook-method.md`](did-foxbook-method.md)
- The cross-canonicalizer validation tool: [`tools/cross-validate-rfc8785/README.md`](../../tools/cross-validate-rfc8785/README.md)
- The trademark notice: [`TRADEMARK.md`](../../TRADEMARK.md)
- ADR 0008 (stable-mode posture): [`docs/decisions/0008-stable-mode-maintenance-posture.md`](../decisions/0008-stable-mode-maintenance-posture.md)
- The W3C DID Specification Registries repo: https://github.com/w3c/did-spec-registries
