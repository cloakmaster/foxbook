import { describe, expect, it } from "vitest";
import { getCapabilityIds, validateCapability } from "../src/index.js";

describe("validateCapability — 22 frozen v1 IDs", () => {
  it("exposes exactly 22 capability IDs", () => {
    expect(getCapabilityIds()).toHaveLength(22);
  });

  it("accepts every ID in the frozen list", () => {
    for (const id of getCapabilityIds()) {
      expect(validateCapability(id)).toBe(true);
    }
  });

  it("rejects unknown IDs", () => {
    expect(validateCapability("unknown-capability")).toBe(false);
    expect(validateCapability("")).toBe(false);
    expect(validateCapability("TEXT-GENERATION")).toBe(false); // case-sensitive
  });

  it("rejects non-string inputs", () => {
    expect(validateCapability(undefined)).toBe(false);
    expect(validateCapability(null)).toBe(false);
    expect(validateCapability(42)).toBe(false);
    expect(validateCapability({ capability_id: "text-generation" })).toBe(false);
  });

  it("avoids bare-noun IDs that would trip core-isolation's banned-capability-literal rule", () => {
    // We can't literal-embed the banned strings here (this file is
    // under packages/** = service-agnostic). Instead, load the ban
    // list from core-isolation.config.json and assert no capability
    // ID matches any entry. This keeps the check real without
    // embedding the strings.
    // biome-ignore lint/correctness/noNodejsModules: test-only IO
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    // biome-ignore lint/correctness/noNodejsModules: test-only IO
    const { fileURLToPath } = require("node:url") as typeof import("node:url");
    const configPath = fileURLToPath(
      new URL("../../../core-isolation.config.json", import.meta.url),
    );
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      bannedCapabilityLiterals: string[];
    };
    const banned = new Set(config.bannedCapabilityLiterals);
    for (const id of getCapabilityIds()) {
      expect(banned.has(id)).toBe(false);
    }
  });
});
