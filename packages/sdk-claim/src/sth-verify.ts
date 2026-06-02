// Signed-tree-head (STH) JWS verification — the cryptographic anchor
// that makes inclusion proofs trustworthy.
//
// Without this, `verify` reconstructs an inclusion proof against an
// UNSIGNED, server-supplied root (the /inclusion endpoint's `rootHex`)
// and never checks who signed the tree head. A malicious or MITM'd log
// server can then serve any leaf + a self-consistent proof + a matching
// `rootHex` and pass verification. This module closes that hole: it
// verifies the STH's Ed25519 signature so callers can pin proofs to the
// SIGNED root rather than an attacker-chosen one.
//
// JWS shape is byte-identical to core/src/crypto/jws.ts (the server-side
// signer): compact "header.payload.signature" with `alg: "EdDSA"`,
// base64url segments, Ed25519 detached signature over the ASCII
// `header.payload` signing input. The STH payload key order is fixed by
// packages/db/src/merkle-repository.ts#signTreeHead:
//   { log_id, tree_size, root_hash, timestamp, version }
//
// We verify via Web Crypto (crypto.subtle Ed25519), available in modern
// Node, Deno, and browsers, to keep sdk-claim's dependency footprint at
// @noble/hashes only. Every failure path (missing key, malformed token,
// wrong alg, bad signature, unavailable Web Crypto) returns a closed
// (failed) result — never a silent pass.

/** hex → Uint8Array. Throws on bad-shape input (odd length / non-hex). */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error(`hex string must have even length, got ${hex.length}`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`hex string contains non-hex character`);
    out[i] = byte;
  }
  return out;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** base64url (no padding) → Uint8Array. Throws on non-base64 input. */
function base64urlDecode(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The verified STH payload — the cross-language shape signed by the log. */
export type SthPayload = {
  log_id: string;
  tree_size: number;
  root_hash: string;
  timestamp: string;
  version: string;
};

export type SthVerifyResult =
  | { valid: true; payload: SthPayload }
  | { valid: false; reason: string };

/**
 * Verify a compact-JWS STH token's Ed25519 signature against a public
 * key (lowercase hex, 32 bytes / 64 chars). Fail-closed: any malformed
 * token, wrong `alg`, bad key, signature mismatch, or environment
 * without Web Crypto Ed25519 returns `{valid: false}` rather than
 * throwing or passing.
 *
 * On success returns the parsed STH payload so the caller can pin an
 * inclusion proof to the SIGNED `root_hash` / `tree_size`.
 */
export async function verifySthJws(token: string, publicKeyHex: string): Promise<SthVerifyResult> {
  // --- public key ---
  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = hexToBytes(publicKeyHex);
  } catch (e) {
    return { valid: false, reason: `bad log_signing_public_key_hex: ${msg(e)}` };
  }
  if (publicKeyBytes.length !== 32) {
    return {
      valid: false,
      reason: `log_signing_public_key_hex must be 32 bytes, got ${publicKeyBytes.length}`,
    };
  }

  // --- token shape ---
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: `STH JWS must have 3 segments, got ${parts.length}` };
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  let sig: Uint8Array;
  try {
    header = JSON.parse(textDecoder.decode(base64urlDecode(headerB64))) as Record<string, unknown>;
    payload = JSON.parse(textDecoder.decode(base64urlDecode(payloadB64))) as Record<
      string,
      unknown
    >;
    sig = base64urlDecode(sigB64);
  } catch (e) {
    return { valid: false, reason: `STH JWS segments not decodable: ${msg(e)}` };
  }

  // Reject anything but EdDSA — never trust a server-chosen alg (an
  // attacker could otherwise downgrade to `none` / a forgeable scheme).
  if (header.alg !== "EdDSA") {
    return { valid: false, reason: `STH JWS expected alg="EdDSA", got ${String(header.alg)}` };
  }
  if (sig.length !== 64) {
    return { valid: false, reason: `Ed25519 signature must be 64 bytes, got ${sig.length}` };
  }

  // --- signature ---
  const signingInput = textEncoder.encode(`${headerB64}.${payloadB64}`);
  let valid: boolean;
  try {
    valid = await verifyEd25519(signingInput, sig, publicKeyBytes);
  } catch (e) {
    // Web Crypto Ed25519 unavailable (very old runtime) — fail closed.
    return { valid: false, reason: `Ed25519 verification unavailable: ${msg(e)}` };
  }
  if (!valid) {
    return { valid: false, reason: "STH JWS signature did not verify against log public key" };
  }

  // --- payload shape ---
  if (
    typeof payload.log_id !== "string" ||
    typeof payload.tree_size !== "number" ||
    typeof payload.root_hash !== "string" ||
    typeof payload.timestamp !== "string" ||
    typeof payload.version !== "string"
  ) {
    return { valid: false, reason: "STH payload missing required fields" };
  }

  return {
    valid: true,
    payload: {
      log_id: payload.log_id,
      tree_size: payload.tree_size,
      root_hash: payload.root_hash,
      timestamp: payload.timestamp,
      version: payload.version,
    },
  };
}

/** Verify an Ed25519 detached signature via Web Crypto (crypto.subtle). */
async function verifyEd25519(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("crypto.subtle is not available in this runtime");
  const key = await subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
  return subtle.verify({ name: "Ed25519" }, key, signature, message);
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
