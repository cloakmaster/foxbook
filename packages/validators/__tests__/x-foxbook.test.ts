import { describe, expect, it } from "vitest";
import { validateXFoxbook } from "../src/index.js";
import { validXFoxbook } from "./fixtures.js";

describe("validateXFoxbook — §6.2 extension", () => {
  it("accepts a canonical valid x-foxbook block", () => {
    const r = validateXFoxbook(validXFoxbook);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  const requiredFields = [
    "did",
    "foxbook_url",
    "verification_tier",
    "class_or_instance",
    "version_hash",
    "signatures",
    "updated_at",
  ] as const;

  for (const field of requiredFields) {
    it(`rejects when required field missing: ${field}`, () => {
      const x = { ...validXFoxbook } as Record<string, unknown>;
      delete x[field];
      const r = validateXFoxbook(x);
      expect(r.valid).toBe(false);
    });
  }

  it("rejects unknown top-level field (additionalProperties: false)", () => {
    const r = validateXFoxbook({ ...validXFoxbook, mystery: "boom" });
    expect(r.valid).toBe(false);
  });

  it("rejects invalid did (lowercase ULID)", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      did: "did:foxbook:01h8xs4whv8yngszpq5xk9qr6m",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects invalid did (wrong prefix)", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      did: "did:other:01H8XS4WHV8YNGSZPQ5XK9QR6M",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects verification_tier > 4 (V1 max)", () => {
    const r = validateXFoxbook({ ...validXFoxbook, verification_tier: 5 });
    expect(r.valid).toBe(false);
  });

  it("rejects verification_tier < 0", () => {
    const r = validateXFoxbook({ ...validXFoxbook, verification_tier: -1 });
    expect(r.valid).toBe(false);
  });

  it("rejects bad class_or_instance enum", () => {
    const r = validateXFoxbook({ ...validXFoxbook, class_or_instance: "species" });
    expect(r.valid).toBe(false);
  });

  it("rejects ed25519_public_key_hex with wrong length", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      signatures: {
        ...validXFoxbook.signatures,
        ed25519_public_key_hex: "a".repeat(63),
      },
    });
    expect(r.valid).toBe(false);
  });

  it("rejects ed25519_public_key_hex with uppercase hex", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      signatures: {
        ...validXFoxbook.signatures,
        ed25519_public_key_hex: "F".repeat(64),
      },
    });
    expect(r.valid).toBe(false);
  });

  it("rejects version_hash without sha256: prefix", () => {
    const r = validateXFoxbook({ ...validXFoxbook, version_hash: "a".repeat(64) });
    expect(r.valid).toBe(false);
  });

  it("rejects bad verified_asset.type enum", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      verified_asset: {
        ...validXFoxbook.verified_asset,
        type: "mastodon",
      },
    });
    expect(r.valid).toBe(false);
  });

  it("rejects unknown payment_rails[].type", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      payment_rails: [{ type: "venmo" }],
    });
    expect(r.valid).toBe(false);
  });

  it("allows extra fields inside reputation sub-object (intentional)", () => {
    const r = validateXFoxbook({
      ...validXFoxbook,
      reputation: { score: 99.1, experimental_field: true },
    });
    expect(r.valid).toBe(true);
  });
});
