# ADR 0005 — Canonical hashing operates on raw objects, never on storage output

**Number:** 0005
**Date:** 2026-04-24
**Status:** accepted
**Supersedes:** —
**Superseded by:** —
**Related:** ADR 0001 (service-agnostic core), ADR 0003 (enums-as-schemas), ADR 0004 (tl-leaf schema evolution + revocation atomicity)

## Context

Day 5 shipped the first live Tier-1 claim end-to-end (PR #14 write path + PR #13 read Worker). The inclusion-proof read path (PR #10's `getInclusionProof` / `getConsistencyProof`) re-serialized `tl_leaves.leaf_data` jsonb through `canonicalJsonBytes(r.leafData)` and rehashed. Postgres `jsonb` reorders object keys on storage (by key length, then ASCIIbetically — confirmed live on the Day-5 leaf: `did(3), leaf_type(9), published_at(12), ed25519_public_key_hex(22), recovery_key_fingerprint(24)`). Re-serializing the jsonb round-trip produced different bytes than the insert-time preimage → different SHA-256 → `/inclusion/0` returning a `rootHex` that didn't match `/root`.

PR #25 fixed the specific case by switching read paths to read `tl_leaves.leaf_hash` directly (stored once at write time) and computing proofs via new `*FromLeafHashes` variants that skip the leaf-hash step. The fix works. But the class of bug is broader than jsonb:

- **bytea encoding drift** — storing bytes as bytea then reading as text (or vice versa) via `cast` / `encode` loses byte-identity.
- **CBOR storage** — a future event store might serialize to CBOR; rehashing a CBOR decode round-trip can drift from the original CBOR bytes.
- **Right-edge jsonb** — `transparency_log.right_edge` is jsonb today. Rehashing any subtree hash derived from re-reading that jsonb falls into the same trap. Today nothing rehashes it (it's consumed as structure, not hashed), but a future "verify right_edge integrity" read path could.
- **DNS TXT record whitespace** — PR C (Day 6) verifies DNS TXT content. TXT records normalize whitespace differently across resolvers + recursive servers; hashing a TXT value read through a DoH resolver and comparing to the original typed value will drift unless we canonicalize first.
- **Cross-restart right_edge re-signing** — if we ever re-derive STHs from stored right_edge state after a process restart, the canonical input to the JWS signer must be the raw object tree, not the jsonb-decode round-trip.

The Day-4 merkle-repository write-path comment literally warned about this — "Any downstream consumer verifying a leaf's inclusion must recompute leaf_hash the same way" — and PR #10's read path I shipped fell into the exact trap anyway. Filing this ADR so the rule is durable architectural policy, not an inline comment a future PR reviewer may miss.

## Decision

**`core/src/crypto/canonical.ts` is the sole canonicalization primitive for any payload that will be hashed or signed.** The rule has three parts:

1. **Hashing operates on `canonical(raw_object)`, never on `JSON.stringify(storage_result)` or `storage_result.toString()` or any round-trip of stored bytes.** The raw object is what the caller constructed in memory before any storage hop. The hash is computed once from that raw object; the result is stored alongside the original payload.

2. **Storage layers lose byte-identity by design.** Postgres `jsonb` reorders keys. Postgres `bytea` may be returned with different encoding wrappers depending on client settings. CBOR libraries may produce different map-ordering. Read-your-writes is fine for *display* and *querying*; it's forbidden for *re-hashing*.

3. **When a read path needs the hash of a stored payload, read the stored hash — do not recompute from stored bytes.** When a read path needs to verify a signature over the original canonical bytes, store the canonical bytes in a `bytea` column (or equivalent) at write time, and operate on *those* exact bytes — not on a rehydrated jsonb decode of the same payload.

### This rule does NOT forbid scout-side rehashing.

Scouts legitimately verify inclusion proofs by hashing a leaf preimage and checking it matches a stored `leaf_hash`. The discipline is that the scout's rehash runs through `canonical.ts` (same impl on both TS and Python sides) **on a raw object the scout constructed from wire input**, NOT on a storage-layer decode of that object. The Day-5 `jws_round_trip` test vector in `schemas/crypto-test-vectors.json` is the continuous cross-language proof of this contract.

### Instances of the class (current and future)

| Storage / encoding | What drifts | Correct pattern |
|---|---|---|
| Postgres `jsonb` | Object key order | Store + read `leaf_hash`; recompute proofs from stored hashes via `*FromLeafHashes` |
| Postgres `bytea` | Encoding wrapper (hex, base64, raw) on read | If the rehash target is the stored bytes, settle the wrapper at write time |
| CBOR store | Map ordering, integer encoding width | Keep raw canonical CBOR as `bytea`; hash it at write + store the hash |
| DNS TXT (PR C, Day 6) | Whitespace normalization across resolvers | Canonicalize the TXT value via `canonical.ts` on raw parsed content before hashing (if we ever hash DNS content — today Tier 2 only does string-contains match, same pattern as Gist adapter) |
| `transparency_log.right_edge` jsonb | Object key order within each entry | Today: consumed as structure, never hashed. Future: if a consumer re-derives subtree hashes from right_edge, read the STH's `root_hash` instead |
| Any future cross-restart state re-signing | Restart-boundary byte drift | Re-sign from raw-object state in memory, or store + reuse the original JWS bytes |

## Enforcement

- **Code review** — PR body for any PR touching a read path that produces a hash MUST reference this ADR and spell out which stored column carries the authoritative hash.
- **packages/db/src/merkle-repository.ts** is the canonical example: `readAllLeafHashes` (NOT `readAllLeafPreimages` — the old function is gone) + `inclusionProofFromLeafHashes` + `consistencyProofFromLeafHashes`.
- **Preflight flag CANONICAL_BOTH_SIDES** (added to Day-6 preflight) greps `packages/db/src/merkle-repository.ts` for `readAllLeafHashes` present AND `readAllLeafPreimages` absent. Any regression fails the Day-N preflight before code is written.
- **Future lint** (filed, not today) — a custom Biome / eslint rule that flags `JSON.stringify(` applied to anything named `leaf_data` / `row.leafData` / `leafRow.` / similar storage-decode patterns in files under `packages/db/`, `apps/api/`, or `apps/transparency/`. Rule-based prevention is cheaper than review vigilance at scale.

## Consequences

- Read-side tree math operates on already-hashed leaves (PR #25's `*FromLeafHashes` variants in `core/src/merkle/tree.ts`). Preimage variants remain the authoritative write-time entry points (`merkle.appendLeaf` still hashes fresh from bytes).
- New storage columns for hash-adjacent payloads will carry both the raw canonical bytes (for signature verification) AND the stored hash (for inclusion proofs). The pair is what makes the rule work; either alone is insufficient.
- Tests that encoded the old forbidden pattern (rehash jsonb) are gone. Any future test that accidentally regresses it will trip the core-isolation preflight when the merkle-repository touches `canonicalJsonBytes(r.leafData)`.
- Cross-language parity is preserved. The Python `sdk-py` verify path reads `leaf_hash` from the wire (via `schemas/merkle-test-vectors.json` in tests, via `/leaf/:index` on the Worker in prod), never rehashes from a reconstructed jsonb.

## Alternatives considered

- **Fix by storing canonical bytes in a bytea column alongside leaf_data jsonb.** This was Day-5's Option A (considered in-session). Rejected for the current fix because PR #25 achieves correctness without a schema migration; the bytea column is still a viable future path if a consumer genuinely needs the original bytes (e.g., re-verifying a historical JWS over leaf content). Filed as a Day-7+ revisit if the need arises.

- **Use a jsonb-preserving text column for leaf_data.** Rejected: loses jsonb query capabilities (indexed paths, `->`, `@>` operators). The data is structured; jsonb is the right storage shape for read patterns beyond hashing. Splitting hash-authoritative bytes from query-friendly jsonb is the correct separation.

- **Rely on `jsonb_pretty` or `jsonb::text` to produce a "canonical" string.** Rejected: Postgres jsonb's text serialization is Postgres-version-dependent and not guaranteed stable across major releases. We own the canonicalization on the client side via `canonical.ts` for a reason.

- **Exempt generated types + forbid rehashing universally.** Over-correction — scouts need to rehash for verification. The discipline is about which bytes they rehash, not whether they rehash at all.

## When this rule can be violated

Only via an ADR that supersedes 0005. Concrete cases that would warrant revision:

1. A future Postgres version (19+) adds a `CANONICAL JSON` column type with deterministic insertion-order-preserving serialization. If stable + cross-version-guaranteed, the rehash path becomes safe. Revisit then.
2. We move to a content-addressed store (IPFS, blake3-tree) where storage is hash-keyed — the storage identity IS the hash, rehashing is trivially correct. Different paradigm; different rule.

## Verified

- PR #25 removed `readAllLeafPreimages` and `canonicalJsonBytes(r.leafData)` from the read path. `getInclusionProof` / `getConsistencyProof` now read `tl_leaves.leaf_hash` directly + compute via `*FromLeafHashes`. Deployed on `https://foxbook-transparency.inkog-io.workers.dev` on 2026-04-24; `/inclusion/0` returns `leafHash` and `rootHex` that match `/root`'s `rootHash`, verified live from a fresh shell with no cookies.
- The Day-4 comment on `merkle-repository.ts` write path — "Any downstream consumer verifying a leaf's inclusion must recompute leaf_hash the same way" — is now enforced by the absence of a read path that rehashes from jsonb. The comment is kept as context; the enforcement is structural.
