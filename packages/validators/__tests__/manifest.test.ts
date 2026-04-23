import { describe, expect, it } from "vitest";
import { validateManifest } from "../src/index.js";
import { validFullManifest, validXFoxbook } from "./fixtures.js";

describe("validateManifest — AgentCard + x-foxbook combined", () => {
  it("accepts a full valid manifest (A2A base + x-foxbook)", () => {
    const r = validateManifest(validFullManifest);
    expect(r.valid).toBe(true);
  });

  it("accepts a bare A2A AgentCard without x-foxbook (third-party A2A surface)", () => {
    const noExt = { ...validFullManifest } as Record<string, unknown>;
    delete noExt["x-foxbook"];
    const r = validateManifest(noExt);
    expect(r.valid).toBe(true);
  });

  it("rejects when x-foxbook is present but malformed", () => {
    const bad = {
      ...validFullManifest,
      "x-foxbook": { ...validXFoxbook, verification_tier: 99 },
    };
    const r = validateManifest(bad);
    expect(r.valid).toBe(false);
  });

  it("rejects when base A2A is malformed even if x-foxbook is valid", () => {
    const bad = { ...validFullManifest, protocolVersion: "0.4.0" };
    const r = validateManifest(bad);
    expect(r.valid).toBe(false);
  });
});
