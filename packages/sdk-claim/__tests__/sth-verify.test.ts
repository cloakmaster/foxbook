// Unit tests for the STH JWS verifier — the cryptographic anchor for
// inclusion-proof trust. Signs throwaway STHs in-test with Web Crypto
// Ed25519 (deterministic per-run keypair) and asserts the verifier
// passes a valid signature and fails CLOSED on every tamper.

import { describe, expect, it } from "vitest";

import { type SthPayload, verifySthJws } from "../src/sth-verify.js";

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * Throwaway Ed25519 keypair + a signer that produces a compact JWS byte-
 * identical to the server's core/src/crypto/jws.ts: protected header
 * {alg:"EdDSA",typ:"JWT"}, JSON.stringify canonicalization (insertion
 * order), base64url segments, Ed25519 over the ASCII signing input.
 */
async function makeSigner(): Promise<{
  publicKeyHex: string;
  signSth: (payload: SthPayload) => Promise<string>;
}> {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const publicKeyHex = bytesToHex(pub);

  async function signSth(payload: SthPayload): Promise<string> {
    const header = { alg: "EdDSA", typ: "JWT" };
    const headerB64 = base64url(textEncoder.encode(JSON.stringify(header)));
    // Key order matches packages/db merkle-repository signTreeHead.
    const orderedPayload = {
      log_id: payload.log_id,
      tree_size: payload.tree_size,
      root_hash: payload.root_hash,
      timestamp: payload.timestamp,
      version: payload.version,
    };
    const payloadB64 = base64url(textEncoder.encode(JSON.stringify(orderedPayload)));
    const signingInput = `${headerB64}.${payloadB64}`;
    const sig = new Uint8Array(
      await crypto.subtle.sign(
        { name: "Ed25519" },
        kp.privateKey,
        textEncoder.encode(signingInput),
      ),
    );
    return `${signingInput}.${base64url(sig)}`;
  }

  return { publicKeyHex, signSth };
}

const STH: SthPayload = {
  log_id: "foxbook-v1",
  tree_size: 1,
  root_hash: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  timestamp: "2026-05-01T08:00:00.000Z",
  version: "1.0-draft",
};

describe("verifySthJws", () => {
  it("verifies a validly signed STH and returns the parsed payload", async () => {
    const { publicKeyHex, signSth } = await makeSigner();
    const token = await signSth(STH);
    const result = await verifySthJws(token, publicKeyHex);
    if (!result.valid) throw new Error(`expected valid, got ${result.reason}`);
    expect(result.payload).toEqual(STH);
  });

  it("fails closed when verified against the WRONG public key", async () => {
    const a = await makeSigner();
    const b = await makeSigner();
    const token = await a.signSth(STH);
    const result = await verifySthJws(token, b.publicKeyHex);
    expect(result.valid).toBe(false);
  });

  it("fails closed when the payload is tampered after signing", async () => {
    const { publicKeyHex, signSth } = await makeSigner();
    const token = await signSth(STH);
    const [h, _p, s] = token.split(".") as [string, string, string];
    // Re-encode a payload with a different (attacker-chosen) root_hash;
    // the original signature no longer covers it.
    const forged = base64url(
      textEncoder.encode(JSON.stringify({ ...STH, root_hash: "00".repeat(32) })),
    );
    const tampered = `${h}.${forged}.${s}`;
    const result = await verifySthJws(tampered, publicKeyHex);
    expect(result.valid).toBe(false);
  });

  it("fails closed on a non-EdDSA alg header (no alg downgrade)", async () => {
    const { publicKeyHex } = await makeSigner();
    const header = base64url(textEncoder.encode(JSON.stringify({ alg: "none" })));
    const payload = base64url(textEncoder.encode(JSON.stringify(STH)));
    const token = `${header}.${payload}.`;
    const result = await verifySthJws(token, publicKeyHex);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("EdDSA");
  });

  it("fails closed on a malformed token (not 3 segments)", async () => {
    const { publicKeyHex } = await makeSigner();
    const result = await verifySthJws("not-a-jws", publicKeyHex);
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("3 segments");
  });

  it("fails closed on a public key of the wrong length", async () => {
    const { signSth } = await makeSigner();
    const token = await signSth(STH);
    const result = await verifySthJws(token, "ab"); // 1 byte
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("32 bytes");
  });

  it("fails closed on a non-hex public key", async () => {
    const { signSth } = await makeSigner();
    const token = await signSth(STH);
    const result = await verifySthJws(token, "zz".repeat(32));
    expect(result.valid).toBe(false);
  });
});
