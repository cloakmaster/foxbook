import { describe, expect, it } from "vitest";
import { validateAgentCard } from "../src/index.js";
import { validAgentCard } from "./fixtures.js";

describe("validateAgentCard — A2A v0.3.0 base", () => {
  it("accepts a canonical valid AgentCard", () => {
    const r = validateAgentCard(validAgentCard);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  const requiredFields = [
    "name",
    "description",
    "url",
    "version",
    "protocolVersion",
    "capabilities",
    "skills",
    "defaultInputModes",
    "defaultOutputModes",
  ] as const;

  for (const field of requiredFields) {
    it(`rejects when required field missing: ${field}`, () => {
      const card = { ...validAgentCard } as Record<string, unknown>;
      delete card[field];
      const r = validateAgentCard(card);
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path.includes(field) || e.keyword === "required")).toBe(true);
    });
  }

  it("rejects protocolVersion != 0.3.0 (pin)", () => {
    const r = validateAgentCard({ ...validAgentCard, protocolVersion: "0.4.0" });
    expect(r.valid).toBe(false);
  });

  it("rejects empty skills array (minItems: 1)", () => {
    const r = validateAgentCard({ ...validAgentCard, skills: [] });
    expect(r.valid).toBe(false);
  });

  it("rejects skill missing required id", () => {
    const r = validateAgentCard({
      ...validAgentCard,
      skills: [{ name: "Chat", description: "..." }],
    });
    expect(r.valid).toBe(false);
  });

  it("rejects unknown additionalInterfaces.transport enum", () => {
    const r = validateAgentCard({
      ...validAgentCard,
      additionalInterfaces: [{ url: "http://x", transport: "WEBSOCKET" }],
    });
    expect(r.valid).toBe(false);
  });

  it("rejects url that is not a URI", () => {
    const r = validateAgentCard({ ...validAgentCard, url: "not a uri" });
    expect(r.valid).toBe(false);
  });

  it("allows A2A-forward-compat unknown top-level fields (no additionalProperties: false)", () => {
    const r = validateAgentCard({
      ...validAgentCard,
      supportsAuthenticatedExtendedCard: true,
    });
    expect(r.valid).toBe(true);
  });

  it("emits human-readable messages via ajv-errors", () => {
    const r = validateAgentCard({ ...validAgentCard, skills: [] });
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.message).toBeTypeOf("string");
    expect(r.errors[0]?.message.length).toBeGreaterThan(0);
  });
});
