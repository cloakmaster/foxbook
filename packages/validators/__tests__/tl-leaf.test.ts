import { describe, expect, it } from "vitest";
import { validateTlLeaf } from "../src/index.js";
import { validAgentKeyRegistrationLeaf } from "./fixtures.js";

describe("validateTlLeaf — v0 taxonomy (agent-key-registration only)", () => {
  it("accepts a canonical agent-key-registration leaf", () => {
    const r = validateTlLeaf(validAgentKeyRegistrationLeaf);
    expect(r.valid).toBe(true);
  });

  it("rejects an unknown leaf_type (taxonomy deferral — claim/rotation/revocation not yet)", () => {
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

  it("rejects additional properties (taxonomy is closed for v0)", () => {
    const r = validateTlLeaf({
      ...validAgentKeyRegistrationLeaf,
      extra: "nope",
    });
    expect(r.valid).toBe(false);
  });
});
