// Byte-parity proof for packages/db/scripts/resign-tree-head.mjs.
//
// That script re-signs a stored STH during recovery, and deliberately
// imports nothing from @foxbook/* — a recovery tool has to work when the
// workspace doesn't build, and @foxbook/core resolves to TypeScript
// source plain `node` cannot load. The cost of that independence is a
// hand-rolled duplicate of jwsSign/keypairFromSeed, which could drift.
//
// If it drifts, the script writes an STH that no verifier accepts — the
// exact failure it exists to repair, applied by the repair tool. These
// tests are the continuous proof that it hasn't drifted. If they go red,
// the script is not safe to run.
//
// No database. Pure crypto/serialization comparison.

import { jwsSign as coreJwsSign, jwsVerify as coreJwsVerify, keypairFromSeed } from "@foxbook/core";
import { describe, expect, it } from "vitest";

import {
  STH_VERSION,
  jwsSign as scriptJwsSign,
  jwsVerifyRaw as scriptJwsVerifyRaw,
  keypairFromSeed as scriptKeypairFromSeed,
  sthPayload,
} from "../../../packages/db/scripts/resign-tree-head.mjs";

const SEED = new Uint8Array(32).fill(0x5c);
const HEADER = { alg: "EdDSA", typ: "JWT" } as const;
const ROOT = "1b0b85a4c6fe50981bcd6c4590336d6b1051f53903a9def514dad7c1d4e9055b";
const TS = "2026-07-29T12:00:00.000Z";

function hex(b: Uint8Array): string {
  return Buffer.from(b).toString("hex");
}

describe("resign-tree-head.mjs parity with @foxbook/core", () => {
  it("derives the same public key from a seed", () => {
    const core = keypairFromSeed(SEED);
    const script = scriptKeypairFromSeed(SEED);
    expect(hex(new Uint8Array(script.publicKeyRaw))).toBe(hex(core.publicKey));
  });

  it("produces a byte-identical JWS for the same STH payload", () => {
    const payload = sthPayload("foxbook-v1", 10, ROOT, TS);
    expect(scriptJwsSign(HEADER, payload, SEED)).toBe(coreJwsSign(HEADER, payload, SEED));
  });

  it("emits the STH payload shape the repository signs", () => {
    // Key ORDER is load-bearing: canonicalJsonBytes is JSON.stringify,
    // which preserves insertion order, so a reordered payload is a
    // different byte stream and a different signature.
    expect(Object.keys(sthPayload("foxbook-v1", 10, ROOT, TS))).toEqual([
      "log_id",
      "tree_size",
      "root_hash",
      "timestamp",
      "version",
    ]);
    expect(STH_VERSION).toBe("1.0-draft");
  });

  it("core verifies what the script signs", () => {
    const token = scriptJwsSign(HEADER, sthPayload("foxbook-v1", 10, ROOT, TS), SEED);
    expect(coreJwsVerify(token, keypairFromSeed(SEED).publicKey).valid).toBe(true);
  });

  it("the script verifies what core signs", () => {
    const token = coreJwsSign(HEADER, sthPayload("foxbook-v1", 10, ROOT, TS), SEED);
    expect(scriptJwsVerifyRaw(token, scriptKeypairFromSeed(SEED).publicKeyRaw)).toBe(true);
  });

  it("rejects a token signed by a different key", () => {
    const token = scriptJwsSign(HEADER, sthPayload("foxbook-v1", 10, ROOT, TS), SEED);
    const otherPub = scriptKeypairFromSeed(new Uint8Array(32).fill(0x99)).publicKeyRaw;
    expect(scriptJwsVerifyRaw(token, otherPub)).toBe(false);
  });

  it("rejects a tampered payload under the original signature", () => {
    const token = scriptJwsSign(HEADER, sthPayload("foxbook-v1", 10, ROOT, TS), SEED);
    const [h, , s] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify(sthPayload("foxbook-v1", 11, ROOT, TS)),
      "utf8",
    ).toString("base64url");
    const pub = scriptKeypairFromSeed(SEED).publicKeyRaw;
    expect(scriptJwsVerifyRaw(`${h}.${forged}.${s}`, pub)).toBe(false);
  });
});
