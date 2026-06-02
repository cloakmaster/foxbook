# The `did:foxbook` DID Method Specification (v1.0)

**Status**: Draft 1.0 — candidate for W3C DID method registry submission.
**Maintainer**: Benjamin Bandali ([@cloakmaster](https://github.com/cloakmaster)).
**Reference implementation**: [`cloakmaster/foxbook`](https://github.com/cloakmaster/foxbook), Apache 2.0.
**Canonical deployment**: [`https://transparency.foxbook.dev`](https://transparency.foxbook.dev).
**Date**: 2026-05-15.
**Editor's notes**: this specification documents the existing operational behaviour of the `did:foxbook` method as implemented in the reference deployment as of v0.2.1 of the SDK. It is a description of shipped functionality, not a proposal for new functionality.

---

## 1. Introduction

`did:foxbook` is a [W3C Decentralized Identifier (DID)](https://www.w3.org/TR/did-core/) method anchored by a public, append-only, [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162)-shaped Merkle transparency log. The method addresses **verifiable agent identity** in the agent-to-agent (A2A) and Model Context Protocol (MCP) ecosystems: each `did:foxbook:` identifier has a public history of all key registrations, key rotations, and revocations recorded in a transparency log that any third party can read, verify inclusion proofs against, and audit retroactively.

The method differs from `did:web` in that the binding between the DID and its associated keys is anchored in a transparency log entry (with inclusion proof + signed tree head), not in DNS + HTTPS host control. It differs from `did:key` in that keys are tied to a stable identifier (the ULID) that persists across key rotation. It differs from `did:plc` and `did:ion` in that the substrate is a single-instance RFC 9162-shaped log (operationally federable, but currently single-operator) rather than a sidetree / consensus-based ledger.

This specification follows the [DID Core 1.0](https://www.w3.org/TR/did-core/) abstract data model and the [DID Specification Registries](https://www.w3.org/TR/did-spec-registries/) format conventions. The method is intended for inclusion in the W3C DID method registry as a non-cryptocurrency, non-ledger DID method.

### 1.1 Design goals

1. **Cryptographic verifiability** without requiring trust in the operator of the transparency log: every claim about a `did:foxbook:` identifier is backed by a Merkle inclusion proof against a signed tree head that anyone can independently verify.
2. **Atomic revocation** with audit-history preservation: revocation of a `did:foxbook:` identifier appends a revocation leaf to the log while deleting the current claim row, in a single database transaction (see [ADR 0004 addendum-1](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/0004-tl-leaf-schema-evolution.md)). Past inclusion proofs continue to verify forever.
3. **Recovery-key/signing-key separation**: a leaked signing key allows impersonation only until revocation; a leaked *recovery* key allows denial-of-service (revoke + re-claim by attacker) but not impersonation, because new keys can only be registered through the recovery-key-signed pathway.
4. **Cross-implementation byte-match**: the JCS canonicalization ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)) of all signed structures produces byte-identical output across language implementations. Test vectors at [`schemas/crypto-test-vectors.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/crypto-test-vectors.json).
5. **Federation-capable** even while operationally single-instance: nothing in the protocol contract prevents independent operators from running parallel transparency logs against the same DID method spec. The current deployment is one log; the spec is multi-log compatible.

### 1.2 Out of scope

- **Identity attributes beyond cryptographic keys.** `did:foxbook` is an identity primitive, not a profile system. Names, capabilities, reputation, and other attributes belong in higher-layer protocols that compose against the DID (see [`docs/COMPOSE-WITH-FOXBOOK.md`](https://github.com/cloakmaster/foxbook/blob/main/docs/COMPOSE-WITH-FOXBOOK.md) for the composition surface).
- **Authorization decisions.** `did:foxbook` answers "is this signing key bound to this identifier in the log?" — not "should this identifier be allowed to do X?". Authorization is a verdict-layer concern.
- **Reputation scoring.** The transparency log records facts (key registered at time T; key revoked at time T'), not opinions. Reputation systems can compose on top.

---

## 2. Method-Specific Identifier (MSI)

### 2.1 Syntax

```
did:foxbook:<msi>
```

The `<msi>` portion is a 26-character [ULID](https://github.com/ulid/spec) (Universally Unique Lexicographically Sortable Identifier) in Crockford's Base32 encoding (uppercase only).

#### 2.1.1 ABNF

```abnf
did-foxbook       = "did:foxbook:" foxbook-specific-idstring
foxbook-specific-idstring = ulid
ulid              = ulid-timestamp ulid-randomness
ulid-timestamp    = 10*10(crockford-base32-char-restricted-leading) crockford-base32-char *9
ulid-randomness   = 16*16(crockford-base32-char)
crockford-base32-char = %x30-39 / %x41-48 / %x4A-4B / %x4D-4E / %x50-54 / %x56-5A
                        ; 0-9, A-H, J-K, M-N, P-T, V-Z
                        ; excludes I, L, O, U per Crockford's Base32 spec
crockford-base32-char-restricted-leading = %x30-37
                        ; 0-7 — restricts the high 3 bits of the timestamp
                        ; (per ULID spec, max valid timestamp is year 10889)
```

#### 2.1.2 Regular expression

A conforming verifier MAY use the following PCRE-compatible regex to validate an MSI:

```
^did:foxbook:[0-7][0-9A-HJKMNP-TV-Z]{25}$
```

#### 2.1.3 Test vectors

The reference implementation ships test vectors at [`schemas/crypto-test-vectors.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/crypto-test-vectors.json) under the `did_foxbook` key:

**Valid**:
- `did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M`
- `did:foxbook:01HXXXXXXXXXXXXXXXXXXXXXXX`

**Invalid** (and the rule violated):
- `01H8XS4WHV8YNGSZPQ5XK9QR6M` — missing `did:foxbook:` prefix
- `did:foxbook:` — empty MSI
- `did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6` — 25 chars, must be 26
- `did:foxbook:01h8xs4whv8yngszpq5xk9qr6m` — lowercase, must be uppercase
- `did:other:01H8XS4WHV8YNGSZPQ5XK9QR6M` — wrong method prefix

### 2.2 MSI assignment

The MSI is generated at the time of key registration. The reference implementation uses a server-side ULID generator that ensures monotonicity within a millisecond and reasonable randomness across DIDs.

### 2.3 Identifier stability

The MSI is permanent and never reissued. If a `did:foxbook:` identifier is revoked (see §3.4), its MSI is not reused for any future claim. The same handle may be re-claimed by a different actor, generating a new MSI.

---

## 3. Method Operations

The four canonical DID method operations (Create, Read, Update, Deactivate) map to the following Foxbook transparency-log events:

| DID Method Operation | Foxbook Event | Transparency Log Leaf Type |
|---|---|---|
| **Create** | Key registration | `agent-key-registration` |
| **Read** | Resolve | (no leaf — query against current state + log) |
| **Update** | Signing-key rotation | `signing-key-registration` |
| **Deactivate** | Revocation | `revocation` |

All write-side operations append a leaf to the transparency log. The log is RFC 9162-shaped: every leaf has a stable index, a leaf hash, and is covered by every signed tree head (STH) issued after the leaf is appended.

### 3.1 Create

A new `did:foxbook:` identifier is created via the *claim flow*: the operator-side software (typically `@foxbook/sdk-claim`) generates an Ed25519 signing keypair and an Ed25519 recovery keypair, asserts a handle claim against a chosen asset surface (e.g., a GitHub handle), and submits the claim for verification.

Once the claim is accepted, an `agent-key-registration` leaf is appended to the transparency log:

```json
{
  "leaf_type": "agent-key-registration",
  "did": "did:foxbook:<ULID>",
  "ed25519_public_key_hex": "<64-char hex>",
  "recovery_key_fingerprint": "sha256:<hex>",
  "published_at": "<RFC 3339 timestamp>"
}
```

The leaf body is signed by the **signing key**. The leaf is then included in the next signed tree head.

**Create-side preconditions**:
- The MSI must not collide with any existing `did:foxbook:` identifier in the log (ULID uniqueness; the reference implementation enforces this at the database layer).
- The Ed25519 public key must validate against [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032).
- The handle claim (where applicable) must pass the [identity-guard adversarial check](https://github.com/cloakmaster/foxbook/blob/main/ops/evidence/2026-04-24-identity-guard-adversarial.md): the asset URL's path identity must equal the claimed handle *before* any content fetch.

### 3.2 Read (Resolve)

Resolution of a `did:foxbook:` identifier returns a [DID Document](https://www.w3.org/TR/did-core/#did-documents) representing the current operational state.

#### 3.2.1 Resolution endpoint

The canonical resolution endpoint is:

```
GET https://api.foxbook.dev/agents/<did>
```

Where `<did>` is the full `did:foxbook:<ULID>` (URL-encoded).

The reference implementation's TypeScript SDK provides a higher-level wrapper:

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const result = await verifyAgentCard(card, { asset_type: "github_handle", requireFreshSTH: 3600 });
switch (result.status) {
  case "verified":         /* DID Document available in result */
  case "unverified":       /* claim not in log, or revoked */
  case "handle-mismatch":  /* DID-to-handle binding broken */
  case "stale-proof":      /* inclusion proof's STH is older than requireFreshSTH */
}
```

#### 3.2.2 DID Document shape

A resolved `did:foxbook:` DID Document SHALL have at minimum the following form:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
  "verificationMethod": [
    {
      "id": "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      "publicKeyMultibase": "z<base58btc-encoded Ed25519 public key>"
    }
  ],
  "authentication": [
    "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M#key-1"
  ],
  "assertionMethod": [
    "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M#key-1"
  ]
}
```

Additional method-specific metadata MAY be carried under the `service` array or as Foxbook-specific top-level fields when the resolver returns the full verification surface:

```json
{
  "service": [
    {
      "id": "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M#transparency-log",
      "type": "FoxbookTransparencyLog",
      "serviceEndpoint": "https://transparency.foxbook.dev/leaf/<leafIndex>"
    }
  ]
}
```

#### 3.2.3 DID Resolution Metadata

The resolver SHOULD return DID resolution metadata as follows:

```json
{
  "didDocumentMetadata": {
    "created": "<RFC 3339 — registration timestamp>",
    "updated": "<RFC 3339 — last rotation timestamp; absent if no rotation>",
    "deactivated": false,
    "foxbook": {
      "tl_leaf_index": <integer>,
      "tl_leaf_canonical_hash": "sha256:<hex>",
      "sth_at_verify_time": {
        "tree_size": <integer>,
        "timestamp": "<RFC 3339>",
        "sth_signature": "<base64url JWS over canonical STH bytes>"
      }
    }
  }
}
```

The `foxbook` extension under `didDocumentMetadata` exposes the transparency-log evidence: which leaf is the current key registration for this DID, and which signed tree head was current at verification time. Consumers MAY independently verify the inclusion proof at `https://transparency.foxbook.dev/inclusion/<leafIndex>`.

If the DID has been revoked, the resolver SHALL set `didDocumentMetadata.deactivated = true` and return an empty `verificationMethod` array. The historical key information remains available in the transparency log (queryable by leaf index) for audit purposes.

#### 3.2.4 Inclusion proof verification

Any resolver SHOULD verify (and any independent verifier MAY verify) the inclusion proof for the leaf identified in `didDocumentMetadata.foxbook.tl_leaf_index` against the signed tree head returned in `didDocumentMetadata.foxbook.sth_at_verify_time`. The verification follows RFC 9162 §2.1.3.1:

1. Fetch the inclusion proof: `GET https://transparency.foxbook.dev/inclusion/<leafIndex>`
2. Reconstruct the root hash from `tl_leaf_canonical_hash` + the proof's hash path
3. Verify that the reconstructed root matches `sth_at_verify_time.sth_signature`'s claimed root
4. Verify the STH signature against the published STH-signing public key at `https://transparency.foxbook.dev/.well-known/jwks.json`

A conforming resolver SHOULD reject any DID resolution where inclusion proof verification fails.

### 3.3 Update — Signing-key rotation

A `did:foxbook:` identifier MAY rotate its signing key. The rotation operation:

1. The DID controller generates a new Ed25519 signing keypair.
2. The controller constructs a `signing-key-registration` leaf:

```json
{
  "leaf_type": "signing-key-registration",
  "did": "did:foxbook:<ULID>",
  "new_ed25519_public_key_hex": "<64-char hex>",
  "previous_leaf_index": <integer — index of the prior registration>,
  "published_at": "<RFC 3339 timestamp>"
}
```

3. The leaf body is signed by the **recovery key** (not the old or new signing key — the recovery key authorizes the rotation).
4. The leaf is appended to the log and covered by the next STH.

After rotation, resolution of the DID returns the *new* signing key in the DID Document. The old key remains in the transparency log (forever) as audit history. Old signatures made under the old key continue to verify against the historical leaf, but the DID Document no longer authorizes the old key for future signatures.

Per [ADR 0004 addendum-3](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/0004-tl-leaf-schema-evolution.md), the rotation transition window may produce `key-not-yet-logged` outcomes for verifiers that fetch a card signed with the new key before the new leaf has been propagated through STH issuance; consumers SHOULD treat this as transient and retry after the freshness window (`requireFreshSTH` option).

### 3.4 Deactivate — Revocation

A `did:foxbook:` identifier MAY be revoked. The revocation operation:

1. The DID controller (or recovery-key holder) constructs a `revocation` leaf:

```json
{
  "leaf_type": "revocation",
  "did": "did:foxbook:<ULID>",
  "reason_code": "voluntary | compromise | recovery-key-action",
  "published_at": "<RFC 3339 timestamp>"
}
```

2. The leaf body is signed by the **recovery key**.
3. The reference implementation appends the revocation leaf to the transparency log **and** deletes the current claim row from the by-handle database in a single atomic transaction (per [ADR 0004 addendum-1](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/0004-tl-leaf-schema-evolution.md)).
4. The next STH covers the revocation leaf.

After revocation:
- Resolution of the DID returns `didDocumentMetadata.deactivated = true` with an empty `verificationMethod` array.
- The by-handle endpoint returns `claim-not-found` (the claim row is gone).
- Past inclusion proofs of the original key registration still verify against historical STHs (the leaf at the original index never changes).
- Historical signatures made before revocation can still be audit-verified by walking the log; verdict-layer policy decides whether to honor them (the answer is typically "no for new actions, yes for historical audit").

The two operational sources of truth — the log and the by-handle endpoint — never disagree about revocation state because the operation is atomic. This is a structural property of the schema/migration discipline (ADR 0004 addendum-1) rather than a runtime guarantee.

---

## 4. Security Considerations

### 4.1 Key compromise

#### 4.1.1 Signing-key compromise

A compromised signing key allows the attacker to produce valid signatures attributable to the `did:foxbook:` identifier until the DID is revoked or the key is rotated. Defensive properties:

- The attacker cannot register a *new* `did:foxbook:` identifier under the victim's handle; the new claim would generate a new ULID and the original DID's signing key remains separately compromised.
- The attacker cannot rotate the victim's signing key without the recovery key.
- The attacker cannot suppress the historical key-registration leaf; it stays in the log forever.

Mitigation: revoke the DID via the recovery key (§3.4), then re-claim the handle with a fresh keypair (which generates a new ULID).

#### 4.1.2 Recovery-key compromise

A compromised recovery key allows the attacker to revoke the victim's DID, which is a **denial-of-service** attack: the legitimate owner loses operational use of the DID until they generate a new keypair pair and re-claim the handle (under a new ULID).

The attacker **cannot impersonate** the victim because new claims require generating a fresh signing keypair, which produces a different `did:foxbook:` identifier. Past signatures under the victim's signing key continue to verify against the historical leaf; verdict-layer policy decides retroactive validity.

Mitigation: recovery keys SHOULD be held in colder storage than signing keys, ideally on an air-gapped device or hardware security module. The reference implementation does not enforce HSM use; this is an operational discipline of the DID controller.

#### 4.1.3 Multi-signature recovery

The current method does not specify multi-signature recovery (M-of-N recovery keys). This is filed for v1.1+ pending high-value-identity deployment justification. Implementations MAY layer multi-sig at the operator level (e.g., recovery key is itself an output of a Shamir Secret Sharing reconstruction) without changing the on-the-wire DID method.

### 4.2 Transparency-log operator trust

The current reference deployment runs a single transparency log operated by the maintainer. A malicious or compromised log operator could in principle:

1. **Refuse to register** legitimate claims (denial-of-service to specific actors). Mitigation: any operator can run a parallel log; the protocol is open.
2. **Sign a tree head whose root does not match the actual leaves** (cryptographic dishonesty). Mitigation: gossip protocols (consistency proofs between STHs) allow third parties to detect log-fork misbehavior. Foxbook's STH endpoints support consistency-proof queries: `GET /consistency/<from>/<to>`. A monitor that requests consistency proofs between every STH it sees can detect any STH that fails consistency.
3. **Withhold inclusion proofs** for specific leaves. Mitigation: the leaf bytes are public; the proof is recomputable by any third party with a full log copy. The threat is "log operator stops serving" rather than "log operator can cryptographically lie."

The trust assumption is **transparency-log-honest-or-detected**, the same assumption underpinning Certificate Transparency (RFC 9162), Sigsum, and Sigstore. Foxbook inherits the same threat model.

### 4.3 Replay and freshness

Inclusion proofs are not time-bounded by themselves. A verifier that requires freshness (e.g., to reject signatures made after a revocation) MUST consult the most recent STH and verify that the leaf's index is covered. The reference SDK exposes this as `requireFreshSTH: <max-age-in-seconds>`; verifiers SHOULD set a freshness window appropriate for their threat model.

### 4.4 Canonicalization correctness

All signed structures (leaf bodies, STHs, etc.) are canonicalized per RFC 8785 JCS before signing. A canonicalization bug that produces different bytes on different implementations is a critical defect — see [`SECURITY.md`](https://github.com/cloakmaster/foxbook/blob/main/SECURITY.md). The reference implementation publishes cross-language test vectors at [`schemas/crypto-test-vectors.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/crypto-test-vectors.json); the canonicalize@2.1.0 reference (erdtman) is the primary canonicalizer. The format is independently reproducible by any conforming RFC 8785 implementation (e.g., `trailofbits/rfc8785.py`); a passing run against the published cross-language vectors is the operational validation.

### 4.5 DID method confusion

Implementations MUST verify the method prefix `did:foxbook:` before treating an identifier as a Foxbook DID. A `did:web:foxbook.dev` is NOT a `did:foxbook:` and resolves to different infrastructure (HTTPS host control vs. transparency-log inclusion).

---

## 5. Privacy Considerations

### 5.1 Public-by-design

`did:foxbook:` is a **public ledger** identity primitive. Every key registration, every rotation, every revocation is public-readable, indexable, and persistent. Operators who require unlinkability between agent activities and a public identity SHOULD NOT use `did:foxbook:` as their primary DID method.

### 5.2 Handle binding

When a `did:foxbook:` identifier is bound to a public handle (e.g., a GitHub username), that binding is public and persistent. The handle owner has consented to this binding by completing the claim flow.

If the handle changes (e.g., a GitHub handle rename), the binding in the transparency log becomes stale: the leaf still references the original handle, even if the actor moves to a different one. This is a structural property of an append-only log; the leaf cannot be retroactively updated. Mitigation: revoke the DID and re-claim under the new handle (which generates a new MSI).

### 5.3 No PII in DID Documents

The DID Document shape (§3.2.2) carries only cryptographic material (public keys) and structural references. No PII, no contact information, no demographic data. Operators who layer such data above the DID (e.g., in a separate profile system) should do so under their own privacy regime; Foxbook does not host it.

### 5.4 Pseudonymity vs anonymity

A `did:foxbook:` identifier is pseudonymous by default: the ULID is independent of any public-facing identity until a handle is claimed. Operators who want pseudonymous identifiers MAY use `did:foxbook:` without ever claiming a handle (the agent-key-registration leaf does not require a handle binding). Such identifiers have no public-handle binding but are still ledger-public in the sense that the key registration is recorded.

### 5.5 Right-to-erasure considerations

The transparency log is append-only by cryptographic design. A revocation leaf can deactivate a DID and remove the operational claim, but the historical key registration leaf cannot be excised without breaking the Merkle integrity of the log. Operators subject to right-to-erasure requirements (GDPR Article 17, etc.) SHOULD consider whether the public-ledger nature of `did:foxbook:` is appropriate before adopting; alternative DID methods (`did:key`, `did:peer`) may be more suitable for ephemeral or erasable identity use cases.

---

## 6. Reference Implementations

### 6.1 SDK

- **TypeScript / JavaScript**: [`@foxbook/sdk-claim`](https://www.npmjs.com/package/@foxbook/sdk-claim) on npm. Apache 2.0.

### 6.2 Canonicalization

- **canonicalize@2.1.0** (erdtman, npm) — primary canonicalizer in the reference implementation. RFC 8785 JCS.
- Independently reproducible by any conforming RFC 8785 implementation (e.g., `trailofbits/rfc8785.py`) against the published cross-language test vectors.

### 6.3 Operational deployment

- Transparency log: `https://transparency.foxbook.dev`
- Claim flow API: `https://api.foxbook.dev`
- Project surface: `https://foxbook.dev`

### 6.4 Test vectors

- Crypto: [`schemas/crypto-test-vectors.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/crypto-test-vectors.json)
- Merkle: [`schemas/merkle-test-vectors.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/merkle-test-vectors.json)

### 6.5 JSON Schemas

- DID format validation: [`schemas/x-foxbook.v1.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/x-foxbook.v1.json) (carries the `did:foxbook:` regex as a `$defs/did` shared primitive)
- Transparency-log leaf taxonomy: [`schemas/tl-leaf.v1.json`](https://github.com/cloakmaster/foxbook/blob/main/schemas/tl-leaf.v1.json)

---

## 7. Compatibility

### 7.1 DID Core 1.0 conformance

`did:foxbook` conforms to the [W3C DID Core 1.0](https://www.w3.org/TR/did-core/) abstract data model. Specifically:

- §3.1 (DID syntax) — `did:foxbook:<ULID>` is method-name + method-specific-id, per the generic DID ABNF.
- §5.1.1 (DID Document) — the resolution endpoint produces a JSON document with `@context`, `id`, `verificationMethod`, `authentication`, `assertionMethod` per the DID Core data model.
- §7 (DID resolution) — the canonical resolver at `https://api.foxbook.dev/agents/<did>` implements the DID resolution algorithm, returning a DID Document + DID resolution metadata + DID document metadata.

### 7.2 Composition

`did:foxbook` composes with cross-protocol references via the [typed-reference v1.0 schema](https://github.com/cloakmaster/foxbook/blob/main/schemas/typed-reference.v1.json) (ratified in [cloakmaster/foxbook Discussion #73](https://github.com/cloakmaster/foxbook/discussions/73) on 2026-05-08). Composition partners include Concordia v0.5.1 (evidence layer) and Sanctuary Castle v1.2 (verdict layer); see [`docs/COMPOSE-WITH-FOXBOOK.md`](https://github.com/cloakmaster/foxbook/blob/main/docs/COMPOSE-WITH-FOXBOOK.md).

### 7.3 Substrate citations

`did:foxbook` is cited as a Layer 2 identity primitive (alternative DID method) in the CTEF v0.3.2 substrate-and-primitive layering figure ([`agentgraph-co/agentgraph/docs/standards/v0.3.2-layering-figure.md`](https://github.com/agentgraph-co/agentgraph/blob/main/docs/standards/v0.3.2-layering-figure.md)) and in the State of Agent Security — Q2 2026 report (AgentGraph, 2026-05-12, [agentgraph.co/state-of-agent-security-2026](https://agentgraph.co/state-of-agent-security-2026)) §3.8 + §4. The byte-match anchor in both citations is `canonicalize@2.1.0` (erdtman RFC 8785 reference impl).

---

## 8. Change Control

The Foxbook DID method specification evolves through the Foxbook project's ADR process. Material changes to the method semantics require:

1. A new Architecture Decision Record in [`docs/decisions/`](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/).
2. A coordinated update to this specification document.
3. A new major version of this specification if the change is not backward-compatible with v1.0 (under which DIDs MUST continue to resolve, sign, and verify per v1.0 semantics).

Minor revisions (clarifications, additional non-normative examples) MAY update v1.0 in place with a dated revision marker.

Per [ADR 0008 (stable-mode posture)](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/0008-stable-mode-maintenance-posture.md), the Foxbook project is in stable maintenance. The DID method semantics described here are not expected to change materially without a triggering external event (regulatory requirement, security defect, normative deprecation upstream).

---

## 9. References

### 9.1 Normative

- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/) — REC, July 2022.
- [W3C DID Specification Registries](https://www.w3.org/TR/did-spec-registries/) — Editor's Draft (continuously updated).
- [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) — Edwards-Curve Digital Signature Algorithm (EdDSA), January 2017.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS), June 2020.
- [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162) — Certificate Transparency Version 2.0, December 2021.
- [ULID Specification](https://github.com/ulid/spec) — Universally Unique Lexicographically Sortable Identifier.

### 9.2 Informative

- [Ed25519VerificationKey2020](https://w3c-ccg.github.io/lds-ed25519-2020/) — W3C CCG.
- [Sigsum](https://www.sigsum.org/) — comparable transparency-log primitive (different semantics).
- [Certificate Transparency](https://certificate.transparency.dev/) — the original RFC 9162 deployment context.
- Foxbook ADRs ([`docs/decisions/`](https://github.com/cloakmaster/foxbook/blob/main/docs/decisions/)):
  - ADR 0004 (tl-leaf schema evolution) + addenda
  - ADR 0005 (canonical bytes are written once)
  - ADR 0006 (protocol, not marketplace)
  - ADR 0008 (stable-mode maintenance posture)
  - ADR 0009 (typed-reference schema for composition)

---

## 10. Editorial Notes

This specification is published under the Apache License 2.0 along with the reference implementation. The "Foxbook" name is a trademark of Benjamin Bandali; see [`TRADEMARK.md`](https://github.com/cloakmaster/foxbook/blob/main/TRADEMARK.md) for the trademark policy. The protocol contract is openly licensed; the trademark is separately protected.

Comments on this draft, including proposed corrections, MAY be filed as issues at [`cloakmaster/foxbook`](https://github.com/cloakmaster/foxbook/issues) or as comments on the W3C registry pull request when this specification is submitted to the [DID Specification Registries](https://github.com/w3c/did-spec-registries) repository.
