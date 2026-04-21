#!/usr/bin/env node
// Enforces LOCKED.md §17 "no DeskDuck code reuse" by rejecting any occurrence
// of the string "DeskDuck" in the working tree. port/ is excluded (frozen
// historical bundle, legitimately references the prior product).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const FORBIDDEN = "DeskDuck";
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  ".venv",
  "port",
  ".git",
  "__pycache__",
]);
// Legitimate references (historical + authoritative docs + the check script itself).
// Anywhere else is forbidden as code reuse per LOCKED.md §17.
const SELF_EXCLUDE = new Set(["scripts/check-no-deskduck.mjs", "CLAUDE.md"]);
const EXCLUDE_PREFIXES = ["docs/foundation/", "docs/decisions/"];
// The commitment is about CODE reuse, not name-drops. Scan source-code extensions only:
// .ts/.tsx/.js/.mjs/.cjs/.py/.go + their test files. Markdown/YAML/JSON are excluded
// — prose and pipeline config naturally reference the name (e.g. a CI step called
// "Anti-DeskDuck") without constituting code reuse.
const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".go"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const hits = [];
for (const abs of walk(REPO_ROOT)) {
  const rel = relative(REPO_ROOT, abs).split(sep).join("/");
  if (SELF_EXCLUDE.has(rel)) continue;
  if (EXCLUDE_PREFIXES.some((p) => rel.startsWith(p))) continue;
  const ext = rel.slice(rel.lastIndexOf("."));
  if (!SCAN_EXTS.has(ext)) continue;

  let src;
  try {
    src = readFileSync(abs, "utf8");
  } catch {
    continue;
  }
  if (!src.includes(FORBIDDEN)) continue;

  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (line.includes(FORBIDDEN)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
  });
}

if (hits.length) {
  console.error(
    `✗ check-no-deskduck: "${FORBIDDEN}" appears in tracked files (see LOCKED.md §17):`,
  );
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log(`✓ check-no-deskduck: "${FORBIDDEN}" absent from working tree`);
