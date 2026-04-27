// Endpoint signed-nonce Tier-2 verification adapter.
//
// The agent's domain hosts an HTTP endpoint that proves control of
// the corresponding signing key by signing a Foxbook-issued nonce.
// Round-trip:
//
//   1. Foxbook generates a fresh random nonce.
//   2. Foxbook POSTs `{ nonce: "<hex>" }` (canonical JSON) to
//      `endpointUrl`.
//   3. The endpoint signs `{ nonce: "<hex>" }` (canonical JSON) with
//      the agent's signing private key (Ed25519) and returns
//      `{ jws: "<compact JWS>" }`.
//   4. Foxbook verifies the JWS signature against the claim's
//      `ed25519PublicKeyHex` AND that the JWS payload's `nonce`
//      matches the nonce it sent. Mismatch → reject (replay /
//      swap defence).
//
// Why both checks: a malicious endpoint could replay a previously-
// issued JWS for any past nonce. Verifying the payload's nonce
// matches the one this round trip issued binds the signature to
// THIS verification attempt.
//
// ADR cross-refs:
//   * ADR 0005 — canonical bytes via core's canonicalJsonBytes
//     (single primitive, never re-derived). The signing input here
//     is exactly canonicalJsonBytes({ nonce }).

import { canonicalJsonBytes, jwsVerify } from "@foxbook/core";

export type EndpointVerifyStatus = "match" | "signature-invalid" | "nonce-mismatch" | "error";

export type EndpointVerifyErrorReason =
  | "http_error"
  | "decode_error"
  | "timeout"
  | "missing_jws"
  | "fetch_failed";

export type EndpointVerifyResult =
  | { status: "match" }
  | { status: "signature-invalid"; reason: string }
  | { status: "nonce-mismatch"; sent: string; received: string }
  | { status: "error"; reason: EndpointVerifyErrorReason; detail?: string };

export type EndpointVerifyOptions = {
  /** Per-fetch timeout. Defaults to 10_000 ms. */
  timeoutMs?: number;
  /** Inject a fetch impl for tests. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/** Hex-decode a 64-char string into a 32-byte Uint8Array. */
function hexToBytes(s: string): Uint8Array {
  if (s.length % 2 !== 0) {
    throw new Error(`hex string length must be even, got ${s.length}`);
  }
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`invalid hex at offset ${i * 2}`);
    }
    out[i] = byte;
  }
  return out;
}

const textDecoder = new TextDecoder();

/**
 * Sign-nonce round trip against `endpointUrl` using the agent's
 * `publicKeyHex` as the verification anchor. The caller supplies the
 * nonce so it owns the freshness guarantee.
 */
export async function verifyEndpointSignedNonce(
  endpointUrl: string,
  nonce: string,
  publicKeyHex: string,
  opts: EndpointVerifyOptions = {},
): Promise<EndpointVerifyResult> {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let publicKey: Uint8Array;
  try {
    publicKey = hexToBytes(publicKeyHex);
  } catch (e) {
    return {
      status: "error",
      reason: "decode_error",
      detail: `publicKeyHex parse: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Canonical JSON serialization of the request body. Same primitive
  // both sides of the wire use to compute signing bytes.
  const requestBodyBytes = canonicalJsonBytes({ nonce });
  const requestBody = textDecoder.decode(requestBodyBytes);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res: Response;
    try {
      res = await fetchImpl(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { status: "error", reason: "timeout" };
      }
      return {
        status: "error",
        reason: "fetch_failed",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    if (!res.ok) {
      return {
        status: "error",
        reason: "http_error",
        detail: `endpoint returned HTTP ${res.status}`,
      };
    }

    let body: { jws?: unknown };
    try {
      body = (await res.json()) as { jws?: unknown };
    } catch (e) {
      return {
        status: "error",
        reason: "decode_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    if (typeof body.jws !== "string" || body.jws.length === 0) {
      return {
        status: "error",
        reason: "missing_jws",
        detail: "endpoint response missing 'jws' string field",
      };
    }

    let verifyResult: ReturnType<typeof jwsVerify>;
    try {
      verifyResult = jwsVerify(body.jws, publicKey);
    } catch (e) {
      return {
        status: "signature-invalid",
        reason: e instanceof Error ? e.message : String(e),
      };
    }

    if (!verifyResult.valid) {
      return { status: "signature-invalid", reason: "Ed25519 verification failed" };
    }

    const payloadNonce = verifyResult.payload.nonce;
    if (typeof payloadNonce !== "string") {
      return {
        status: "signature-invalid",
        reason: "JWS payload missing 'nonce' string",
      };
    }

    if (payloadNonce !== nonce) {
      // Signature is valid but for a different nonce — replay / swap
      // attempt. Discriminate so the caller can log the asymmetry.
      return {
        status: "nonce-mismatch",
        sent: nonce,
        received: payloadNonce,
      };
    }

    return { status: "match" };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
