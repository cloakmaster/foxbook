// JSON Canonicalization Scheme (RFC 8785) — produces deterministic
// byte-equal output across implementations.
//
// Different from canonical.ts: that module is for signed payloads
// where the caller controls key order; this module is for arbitrary
// user-supplied JSON where key order can't be assumed.
//
// Implementation wraps `canonicalize` (https://github.com/erdtman/canonicalize)
// authored by Anders Rundgren, who also authored RFC 8785 itself.
// Using the spec-author's reference implementation is the byte-match
// guarantee — a from-scratch impl would beg the question of whether
// our impl actually matches the spec on the IEEE 754 → JSON number-
// formatting edge cases that the RFC defines down to the bit.
//
// Cross-implementation interop:
// - byte-match validated against CTEF v0.3.1 vectors at
//   agentgraph.co/.well-known/cte-test-vectors.json (4/4 SHA-256 match).
//   See ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md for the
//   full report.
// - Used by anyone that needs deterministic JSON over arbitrary input
//   (e.g. signing user-emitted attestations, verifying inclusion
//   proofs over external claim bodies).

import canonicalizeMod from "canonicalize";

// `canonicalize` ships as a CJS module whose `module.exports` is the
// function itself. The package's `.d.ts` declares it as `export default`,
// but under NodeNext module resolution TS surfaces it as a namespace
// rather than a callable. Cast through unknown to the documented signature.
const canonicalize = canonicalizeMod as unknown as (input: unknown) => string | undefined;

const textEncoder = new TextEncoder();

/**
 * RFC 8785 JCS canonical encoding. Returns UTF-8 bytes of the
 * canonicalized JSON string. Throws on input that JCS cannot represent
 * (e.g. NaN, Infinity, undefined at the root).
 *
 * Sample:
 *   canonicalJcsBytes({"b": 1, "a": [2, 3]})  // → utf8 bytes of '{"a":[2,3],"b":1}'
 */
export function canonicalJcsBytes(obj: unknown): Uint8Array {
  const canonical = canonicalize(obj);
  if (canonical === undefined) {
    throw new TypeError("canonicalJcsBytes: input cannot be canonicalized (undefined or non-JSON)");
  }
  return textEncoder.encode(canonical);
}

/**
 * Canonical RFC 8785 JSON string (UTF-16) — for callers that already
 * want a string (e.g. logging, debugging). Most signing and hashing
 * paths should use canonicalJcsBytes() to get UTF-8 bytes directly.
 */
export function canonicalJcsString(obj: unknown): string {
  const canonical = canonicalize(obj);
  if (canonical === undefined) {
    throw new TypeError("canonicalJcsString: input cannot be canonicalized (undefined or non-JSON)");
  }
  return canonical;
}
