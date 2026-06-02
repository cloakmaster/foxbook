import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The prod image (apps/api/Dockerfile) runs `pnpm prune --prod` after install
// to drop devDependencies. The container then boots with
// `node --import tsx ./src/main.ts` — so `tsx` is loaded at RUNTIME in
// production. If tsx lived in devDependencies it would be pruned away and the
// container would crash on boot. Guard the invariant: tsx must be a production
// dependency, never a devDependency.
const pkgUrl = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

describe("@foxbook/api prod-runtime deps", () => {
  it("loads tsx at runtime via the start script", () => {
    // Sanity-check the premise: start really does --import tsx.
    expect(pkg.scripts?.start).toContain("--import tsx");
  });

  it("declares tsx as a production dependency (survives pnpm prune --prod)", () => {
    expect(pkg.dependencies?.tsx).toBeDefined();
  });

  it("does not list tsx in devDependencies (would be pruned from prod image)", () => {
    expect(pkg.devDependencies?.tsx).toBeUndefined();
  });
});
