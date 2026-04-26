import { describe, expect, it } from "vitest";
import { validateTlLeaf } from "../src/index.js";
import { validAgentKeyRegistrationLeaf, validRevocationLeaf } from "./fixtures.js";

describe("validateTlLeaf — v1.0 shape (agent-key-registration)", () => {
  it("accepts a canonical agent-key-registration leaf", () => {
    const r = validateTlLeaf(validAgentKeyRegistrationLeaf);
    expect(r.valid).toBe(true);
  });

  it("rejects an unknown leaf_type that's deferred (claim-event, key-rotation)", () => {
    const r = validateTlLeaf({
      ...validAgentKeyRegistrationLeaf,
      leaf_type: "claim-event",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects when did field has wrong shape (shared $def with x-foxbook)", () => {
    const r = validateTlLeaf({
      ...validAgentKeyRegistrationLeaf,
      did: "did:foxbook:short",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects missing required ed25519_public_key_hex", () => {
    const leaf = {
      ...validAgentKeyRegistrationLeaf,
    } as Record<string, unknown>;
    delete leaf.ed25519_public_key_hex;
    const r = validateTlLeaf(leaf);
    expect(r.valid).toBe(false);
  });

  it("rejects missing required recovery_key_fingerprint", () => {
    const leaf = {
      ...validAgentKeyRegistrationLeaf,
    } as Record<string, unknown>;
    delete leaf.recovery_key_fingerprint;
    const r = validateTlLeaf(leaf);
    expect(r.valid).toBe(false);
  });

  it("rejects additional properties (taxonomy is closed for v1)", () => {
    const r = validateTlLeaf({
      ...validAgentKeyRegistrationLeaf,
      extra: "nope",
    });
    expect(r.valid).toBe(false);
  });
});

describe("validateTlLeaf — v1.1 shape (revocation, ADR 0004 additive bump)", () => {
  it("accepts a canonical revocation leaf with reason_code", () => {
    const r = validateTlLeaf(validRevocationLeaf);
    expect(r.valid).toBe(true);
  });

  it("accepts a revocation leaf with reason_code omitted", () => {
    const leaf = { ...validRevocationLeaf } as Record<string, unknown>;
    delete leaf.reason_code;
    const r = validateTlLeaf(leaf);
    expect(r.valid).toBe(true);
  });

  it("rejects revocation with unknown reason_code", () => {
    const r = validateTlLeaf({
      ...validRevocationLeaf,
      reason_code: "made_up_reason",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects revocation with malformed recovery_key_signature (not 3-segment compact-JWS)", () => {
    const r = validateTlLeaf({
      ...validRevocationLeaf,
      recovery_key_signature: "not-a-jws",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects revocation with revoked_key_hex of wrong length (must be 64 hex chars)", () => {
    const r = validateTlLeaf({
      ...validRevocationLeaf,
      revoked_key_hex: "abc",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects revocation with non-ISO revocation_timestamp", () => {
    const r = validateTlLeaf({
      ...validRevocationLeaf,
      revocation_timestamp: "yesterday",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects revocation with missing did", () => {
    const leaf = { ...validRevocationLeaf } as Record<string, unknown>;
    delete leaf.did;
    const r = validateTlLeaf(leaf);
    expect(r.valid).toBe(false);
  });

  it("rejects revocation with additional properties", () => {
    const r = validateTlLeaf({
      ...validRevocationLeaf,
      extra: "nope",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects payload that is structurally an agent-key-registration leaf with leaf_type=revocation (oneOf strictness)", () => {
    // An agent-key-registration leaf has different required keys
    // (ed25519_public_key_hex, recovery_key_fingerprint, published_at).
    // Setting leaf_type="revocation" on that shape MUST not validate
    // — oneOf branches are exclusive on required + additionalProperties.
    const r = validateTlLeaf({
      ...validAgentKeyRegistrationLeaf,
      leaf_type: "revocation",
    });
    expect(r.valid).toBe(false);
  });

  it("rejects an agent-key-registration leaf relabelled with leaf_type=revocation (defence-in-depth against type-confusion)", () => {
    // Inverse direction of the above: a revocation leaf with
    // leaf_type="agent-key-registration" must also fail — the required
    // fields (ed25519_public_key_hex, published_at) aren't present in
    // a revocation payload.
    const r = validateTlLeaf({
      ...validRevocationLeaf,
      leaf_type: "agent-key-registration",
    });
    expect(r.valid).toBe(false);
  });
});
