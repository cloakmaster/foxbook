# Changelog

All notable changes to `@foxbook/sdk-claim` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This is a pre-1.0 package: per semver, minor bumps (`0.x.0`) may carry
behavior changes; the public type signatures stay backward-compatible within
a `0.x` line.

## [0.3.0] - 2026-06-02

### Security

- **`verify()` now verifies the log's signed tree head (STH) before
  trusting any inclusion proof, and fails closed.** Previously `verify()`
  reconstructed the Merkle inclusion proof against the **unsigned,
  server-supplied** root (`/inclusion` → `rootHex`) and never checked who
  signed the tree head. A malicious or MITM'd transparency log could serve
  any leaf plus a self-consistent proof plus a matching `rootHex` and pass
  verification — defeating the core guarantee. (Fixes the forged-proof hole,
  #90.)

  `verify()` now:
  1. Fetches the log's Ed25519 signing public key
     (`log_signing_public_key_hex`) from
     `{api_base}/.well-known/foxbook.json`. Absent / unreachable → fail.
  2. Verifies the STH compact-JWS (`/root` → `sthJws`) Ed25519 signature
     against that key (via Web Crypto `crypto.subtle`; `alg` pinned to
     `EdDSA`, no algorithm downgrade). Bad / wrong-key / unsigned /
     malformed → fail.
  3. Reconstructs the inclusion proof against the **signed** `root_hash`
     from the verified STH (not `inc.rootHex`), and pins `inc.treeSize` to
     the signed `tree_size`. Mismatch → fail.

  `verifyAgentCard()` threads `api_base` into `verify()` and now also
  verifies the STH signature in the `requireFreshSTH` path — an unsigned
  timestamp is forgeable, so the stale-vs-fresh decision is read off a
  signature-verified payload.

### Added

- New internal module `src/sth-verify.ts` (`verifySthJws`) — verifies the
  STH compact-JWS Ed25519 signature, byte-compatible with the server-side
  signer (`core/src/crypto/jws.ts`) and the STH payload key order from
  `packages/db` `signTreeHead`. No new runtime dependencies; the footprint
  stays at `@noble/hashes`.
- `VerifyInput.api_base?: string` — optional override for the API base used
  to fetch the log signing key. Defaults to `DEFAULT_API_BASE`
  (`https://api.foxbook.dev`).

### Changed (behavior — please read before upgrading)

- A `verify()` / `verifyAgentCard({ requireInclusionProof: true })` call
  that previously returned `valid: true` / `verified` against an unsigned
  root will now return `valid: false` / `unverified` if:
  - the configured `api_base` does not serve
    `/.well-known/foxbook.json` with a `log_signing_public_key_hex`, or
  - the `/root` STH JWS signature does not verify against that key, or
  - the proof does not reconstruct to the signed root / the tree sizes
    disagree.

  This is intentional (fail-closed: evidence over assertion).

### Migration notes

- **No public type / signature change.** `verify(input)` and
  `verifyAgentCard(card, options)` keep the same required parameters;
  `api_base` is **optional with a default**. Existing callers compile and
  run unchanged.
- **Network reachability:** `verify()` already made network calls
  (`/inclusion`, `/root`). This release adds **one additional fetch** to
  `{api_base}/.well-known/foxbook.json`. Hosts / CI environments that
  allowlist outbound traffic must permit the API base (default
  `https://api.foxbook.dev`) in addition to the transparency Worker base
  (default `https://transparency.foxbook.dev`).
- **Self-hosted / non-default deployments:** if you run your own
  transparency log, pass `api_base` (and `worker_base`) pointing at your
  deployment, and ensure your API serves
  `/.well-known/foxbook.json` with a valid `log_signing_public_key_hex`
  whose key signs the `/root` STH. Without it, verification now fails closed.
- **Runtime requirement:** STH verification uses Web Crypto Ed25519
  (`crypto.subtle`), available in modern Node, Deno, and browsers. Very old
  runtimes without it fail closed rather than silently passing.

## [0.2.1] - prior

- Last release before the STH-signature verification fix. `verify()`
  reconstructed inclusion proofs against the unsigned server-supplied root.
  Superseded by 0.3.0 for the security reasons above.
