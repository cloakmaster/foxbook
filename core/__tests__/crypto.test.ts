import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DID_PREFIX,
  didToUlid,
  generateKeypair,
  isDidFoxbook,
  jwsSign,
  jwsVerify,
  keypairFromSeed,
  mintDid,
  sign,
  verify,
} from "../src/index.js";

type VectorsFile = {
  ed25519: Array<{
    name: string;
    seed_hex: string;
    public_key_hex: string;
    message_hex: string;
    signature_hex: string;
  }>;
  did_foxbook: { valid: string[]; invalid: string[] };
  jws_round_trip: {
    seed_hex: string;
    protected_header: Record<string, unknown>;
    payload: Record<string, unknown>;
    expected_token: string;
  };
};

const VECTORS_PATH = fileURLToPath(
  new URL("../../schemas/crypto-test-vectors.json", import.meta.url),
);
const vectors = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as VectorsFile;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

describe("Ed25519 — RFC 8032 vectors", () => {
  for (const v of vectors.ed25519) {
    it(v.name, () => {
      const seed = fromHex(v.seed_hex);
      const message = fromHex(v.message_hex);

      const kp = keypairFromSeed(seed);
      expect(hex(kp.publicKey)).toBe(v.public_key_hex);

      const sig = sign(message, kp.privateKey);
      expect(hex(sig)).toBe(v.signature_hex);

      expect(verify(message, sig, kp.publicKey)).toBe(true);

      // tampering must fail
      const tampered = new Uint8Array(sig);
      tampered[0] ^= 0x01;
      expect(verify(message, tampered, kp.publicKey)).toBe(false);
    });
  }

  it("generateKeypair produces usable 32+32 byte pairs", () => {
    const kp = generateKeypair();
    expect(kp.privateKey.length).toBe(32);
    expect(kp.publicKey.length).toBe(32);
    const msg = new TextEncoder().encode("hello");
    expect(verify(msg, sign(msg, kp.privateKey), kp.publicKey)).toBe(true);
  });
});

describe("JWS compact — EdDSA round-trip", () => {
  const v = vectors.jws_round_trip;
  it("produces the byte-identical cross-language token", () => {
    const kp = keypairFromSeed(fromHex(v.seed_hex));
    const token = jwsSign(v.protected_header, v.payload, kp.privateKey);
    // This is the strongest parity guarantee: TS and Python must emit the
    // exact same bytes for the same deterministic input.
    expect(token).toBe(v.expected_token);

    const verified = jwsVerify(token, kp.publicKey);
    expect(verified.valid).toBe(true);
    expect(verified.protectedHeader).toEqual(v.protected_header);
    expect(verified.payload).toEqual(v.payload);
  });

  it("rejects a tampered payload segment", () => {
    const kp = keypairFromSeed(fromHex(v.seed_hex));
    const token = jwsSign(v.protected_header, v.payload, kp.privateKey);
    const [h, , s] = token.split(".");
    // Swap payload for a different one; signature no longer matches.
    const tampered = `${h}.${btoa(JSON.stringify({ evil: true }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "")}.${s}`;
    expect(jwsVerify(tampered, kp.publicKey).valid).toBe(false);
  });
});

describe("did:foxbook", () => {
  it("mints a well-formed did", () => {
    const did = mintDid();
    expect(did.startsWith(DID_PREFIX)).toBe(true);
    expect(isDidFoxbook(did)).toBe(true);
    const ulid = didToUlid(did);
    expect(ulid).not.toBeNull();
    expect(ulid).toHaveLength(26);
  });

  for (const good of vectors.did_foxbook.valid) {
    it(`accepts valid DID: ${good}`, () => {
      expect(isDidFoxbook(good)).toBe(true);
      expect(didToUlid(good)).toBe(good.slice(DID_PREFIX.length));
    });
  }

  for (const bad of vectors.did_foxbook.invalid) {
    it(`rejects invalid DID: ${bad}`, () => {
      expect(isDidFoxbook(bad)).toBe(false);
      expect(didToUlid(bad)).toBeNull();
    });
  }
});
