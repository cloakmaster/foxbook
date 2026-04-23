#!/usr/bin/env node

// Drift guard for generated types. Regenerates, then compares against what's
// already committed. If anything changed, fail — the committer didn't run
// `pnpm generate:types` after touching a schema.
//
// We avoid shelling out to `git` here (shell-exec lint guard). Strategy:
//   1. Snapshot file bytes of the target outputs BEFORE regeneration.
//   2. Regenerate in-place.
//   3. Compare bytes. If different, restore snapshot and fail.
//      (Restore keeps pre-commit + CI non-destructive for inspection; the
//      offending human runs `pnpm generate:types` themselves.)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const GENERATE_SCRIPT = join(REPO_ROOT, "scripts", "generate-types.mjs");

const targets = [
  "packages/types-ts/src/envelope.ts",
  "packages/types-py/src/foxbook_types/envelope.py",
  "packages/types-ts/src/discover-response.ts",
  "packages/types-py/src/foxbook_types/discover_response.py",
  "packages/types-ts/src/x-foxbook.ts",
  "packages/types-py/src/foxbook_types/x_foxbook.py",
  "packages/types-ts/src/agent-card.ts",
  "packages/types-py/src/foxbook_types/agent_card.py",
];

function snapshot() {
  const snap = new Map();
  for (const rel of targets) {
    const abs = join(REPO_ROOT, rel);
    snap.set(rel, existsSync(abs) ? readFileSync(abs) : null);
  }
  return snap;
}

function restore(snap) {
  for (const [rel, buf] of snap) {
    const abs = join(REPO_ROOT, rel);
    if (buf === null) continue;
    writeFileSync(abs, buf);
  }
}

function bytesEqual(a, b) {
  if (a === null || b === null) return a === b;
  if (a.length !== b.length) return false;
  return a.equals(b);
}

const before = snapshot();

// Use spawnSync with argv array (no shell) — safe from the shell-exec lint.
const r = spawnSync(process.execPath, [GENERATE_SCRIPT], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});
if (r.status !== 0) {
  console.error("✗ check:generated — generate-types failed");
  process.exit(r.status ?? 1);
}

const after = snapshot();

const drifted = [];
for (const rel of targets) {
  if (!bytesEqual(before.get(rel), after.get(rel))) drifted.push(rel);
}

if (drifted.length) {
  console.error("✗ check:generated — generated types drifted from committed output:");
  for (const f of drifted) console.error(`  ${f}`);
  console.error("\n  Fix: run `pnpm generate:types` and commit the result.");
  restore(before); // leave the working tree clean so the human can regenerate themselves
  process.exit(1);
}

console.log(`✓ check:generated — generated types match schema (${targets.length} files)`);
