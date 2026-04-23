// Canonical JSON encoding for signed payloads (JWS compact + Merkle
// STH + anything else that needs byte-equal output across TS and Python).
//
// v1 rule: `JSON.stringify(obj)` with default JS behaviour — no
// whitespace, keys in insertion order, UTF-8 output. Python mirror in
// packages/sdk-py/src/foxbook_sdk/canonical.py uses
// `json.dumps(obj, separators=(",", ":"), ensure_ascii=False)` which
// produces the same byte stream for the same Python dict whose insertion
// order matches the TS object literal.
//
// This is NOT RFC 8785 JCS — it relies on caller-controlled key
// ordering. When the caller fixes the key order (which they do for
// signed blobs: JWS protected headers, STH payloads), output is
// deterministic and cross-language parity holds. The jws_round_trip
// vector in schemas/crypto-test-vectors.json is the continuous proof
// that TS and Python still agree, byte for byte.
//
// If/when Foxbook adopts RFC 8785 (e.g. for signing arbitrary
// user-supplied JSON), that would be a separate `canonicalRfc8785Bytes`
// entry in this module. We don't need it for v1.

const textEncoder = new TextEncoder();

/**
 * Canonical JSON byte encoding for signed payloads. Caller is
 * responsible for key ordering (use a fresh object literal with keys in
 * the desired order). Returns the UTF-8 bytes that get base64url-encoded
 * into a JWS segment or SHA-256-hashed into a Merkle leaf preimage.
 */
export function canonicalJsonBytes(obj: unknown): Uint8Array {
  return textEncoder.encode(JSON.stringify(obj));
}
