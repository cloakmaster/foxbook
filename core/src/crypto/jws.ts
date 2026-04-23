// Minimal JWS compact serialization for EdDSA (Ed25519) per RFC 7515.
// We ship our own impl rather than depend on jose for two reasons:
//   1. The TS and Python sides need byte-identical output. Owning the
//      canonicalization keeps the surface small and comparable.
//   2. Day-2 scope is primitives — a 40-line compact-JWS encoder is
//      easier to audit than a cross-language jose/python-jose parity matrix.
// When richer JWT semantics (aud/iss/exp/nbf) land, we'll revisit.
//
// Day-4 extraction: header/payload canonicalisation moved to
// ./canonical.ts so the Merkle STH signer reuses the exact same rule
// rather than re-implementing `JSON.stringify`. Cross-language parity
// (TS ↔ Python) is asserted by schemas/crypto-test-vectors.json.

import { canonicalJsonBytes } from "./canonical.js";
import { sign as edSign, verify as edVerify } from "./ed25519.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Compact-JWS sign: produces "header.payload.signature" with EdDSA/Ed25519.
 * `protectedHeader` MUST include `alg: "EdDSA"`. Caller controls the header
 * bytes so both TS and Python produce byte-identical tokens for the same
 * JSON input.
 */
export function jwsSign(
  protectedHeader: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: Uint8Array,
): string {
  if (protectedHeader.alg !== "EdDSA") {
    throw new Error(`jwsSign only supports alg="EdDSA", got ${String(protectedHeader.alg)}`);
  }
  const headerB64 = base64url(canonicalJsonBytes(protectedHeader));
  const payloadB64 = base64url(canonicalJsonBytes(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = edSign(textEncoder.encode(signingInput), privateKey);
  return `${signingInput}.${base64url(sig)}`;
}

export type JwsVerifyResult = {
  valid: boolean;
  protectedHeader: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export function jwsVerify(token: string, publicKey: Uint8Array): JwsVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3)
    throw new Error(`JWS compact token must have 3 segments, got ${parts.length}`);
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const protectedHeader = JSON.parse(textDecoder.decode(base64urlDecode(headerB64))) as Record<
    string,
    unknown
  >;
  if (protectedHeader.alg !== "EdDSA") {
    throw new Error(`jwsVerify expected alg="EdDSA", got ${String(protectedHeader.alg)}`);
  }
  const payload = JSON.parse(textDecoder.decode(base64urlDecode(payloadB64))) as Record<
    string,
    unknown
  >;
  const sig = base64urlDecode(sigB64);
  const signingInput = textEncoder.encode(`${headerB64}.${payloadB64}`);
  const valid = edVerify(signingInput, sig, publicKey);
  return { valid, protectedHeader, payload };
}
