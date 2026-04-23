#!/usr/bin/env node
// Core-isolation rule enforcer. See core-isolation.config.json + docs/decisions/0001-service-agnostic-core.md.
//
// Rules enforced:
// 1. Files under serviceAgnosticZones (core/**, packages/**) MUST NOT:
//      - import from adapters/** (any path, any style)
//      - import from any identifier in bannedImports
//      - contain string literals in bannedCapabilityLiterals
// 2. Files under adapters/<name>/** MUST NOT import from adapters/<other>/** (no sibling adapter imports).
//    (Adapters are free to import their own service lib; that's the point.)
// 3. Permanent fixtures in __fixtures__/core-isolation/ MUST produce the expected outcomes:
//      - negative/*  → checker reports at least one violation for each file
//      - positive/*  → checker reports zero violations for each file

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONFIG = JSON.parse(readFileSync(join(REPO_ROOT, "core-isolation.config.json"), "utf8"));

const SCAN_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".py"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", ".venv", "port", ".git"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else {
      const ext = name.slice(name.lastIndexOf("."));
      if (SCAN_EXTS.has(ext)) out.push(full);
    }
  }
  return out;
}

// TS/JS imports. Covers:
//   import ... from "target"    (incl. destructured, type, default, namespace)
//   import "target"             (side-effect)
//   import("target")            (dynamic)
//   require("target")           (CJS)
const TS_FROM_RE = /\bfrom\s+["']([^"']+)["']/g;
const TS_BARE_RE = /\bimport\s+["']([^"']+)["']/g;
const TS_DYN_RE = /\bimport\s*\(\s*["']([^"']+)["']/g;
const TS_REQUIRE_RE = /\brequire\s*\(\s*["']([^"']+)["']/g;
// Python imports:  `from X import Y`  or  `import X`
const PY_IMPORT_RE = /^\s*(?:from\s+([^\s]+)\s+import\b|import\s+([^\s,#]+))/gm;

function extractImports(src, isPython) {
  const out = [];
  if (isPython) {
    for (const m of src.matchAll(PY_IMPORT_RE)) out.push(m[1] ?? m[2]);
    return out;
  }
  for (const re of [TS_FROM_RE, TS_BARE_RE, TS_DYN_RE, TS_REQUIRE_RE]) {
    for (const m of src.matchAll(re)) out.push(m[1]);
  }
  return out;
}

function matchesBanned(imp, bannedList) {
  for (const pattern of bannedList) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (imp === prefix || imp.startsWith(`${prefix}/`)) return pattern;
    } else if (imp === pattern || imp.startsWith(`${pattern}/`)) {
      return pattern;
    }
  }
  return null;
}

function importIsAdapterPath(imp) {
  // External reference to adapters/* — either bare path, relative, or aliased.
  if (imp.startsWith("adapters/")) return true;
  if (imp.includes("../adapters/") || imp.includes("../../adapters/")) return true;
  for (const forbidden of CONFIG.forbiddenFromServiceAgnostic) {
    if (matchesBanned(imp, [forbidden])) return true;
  }
  return false;
}

// Fixtures can declare an @as-if-path so their violations are judged as though
// they lived in a different zone. Example:
//   // @as-if-path: core/src/bad.ts
// Without this hint, the file's real path is used for zone inference.
function fixturePathHint(src) {
  const m = src.match(/^\s*(?:\/\/|#)\s*@as-if-path:\s*([^\s]+)/m);
  return m ? m[1] : null;
}

function scanFile(abs, virtualPath) {
  const relPath = (virtualPath ?? relative(REPO_ROOT, abs)).split(sep).join("/");
  const src = readFileSync(abs, "utf8");
  const isPython = (virtualPath ?? abs).endsWith(".py");
  const inServiceAgnostic = relPath.startsWith("core/") || relPath.startsWith("packages/");
  const adapterMatch = relPath.match(/^adapters\/([^/]+)\//);
  const inAdapter = Boolean(adapterMatch);
  const adapterName = adapterMatch?.[1];

  const violations = [];
  const imports = extractImports(src, isPython);

  for (const imp of imports) {
    if (inServiceAgnostic) {
      if (importIsAdapterPath(imp)) {
        violations.push(`forbidden import of adapter path: "${imp}"`);
      }
      const banned = matchesBanned(imp, CONFIG.bannedImports);
      if (banned) violations.push(`banned import "${imp}" (matches pattern "${banned}")`);
    }
    if (inAdapter) {
      // cross-adapter import check
      const m =
        imp.match(/^(?:\.\.\/)?adapters\/([^/]+)/) ??
        imp.match(/^@foxbook\/adapter-([^/]+)/) ??
        imp.match(/^@foxbook\/adapters\/([^/]+)/);
      if (m && m[1] !== adapterName) {
        violations.push(`adapter "${adapterName}" imports sibling adapter "${m[1]}"`);
      }
    }
  }

  if (inServiceAgnostic) {
    for (const cap of CONFIG.bannedCapabilityLiterals) {
      const re = new RegExp(`["'\`]${cap}["'\`]`, "g");
      if (re.test(src)) {
        violations.push(`banned capability literal "${cap}" in service-agnostic zone`);
      }
    }
  }

  return { file: relPath, violations };
}

function inZone(relPath, zoneGlob) {
  // zoneGlob is "core/**" or "packages/**" or "adapters/*"
  const prefix = zoneGlob.replace(/\*+$/, "").replace(/\/$/, "");
  return relPath === prefix || relPath.startsWith(`${prefix}/`);
}

function runMainScan() {
  const allFiles = walk(REPO_ROOT).filter((abs) => {
    const rel = relative(REPO_ROOT, abs).split(sep).join("/");
    if (rel.startsWith("__fixtures__/")) return false;
    if (rel.startsWith("scripts/")) return false;
    return inZone(rel, "core/**") || inZone(rel, "packages/**") || inZone(rel, "adapters/*");
  });
  const violations = [];
  for (const abs of allFiles) {
    const r = scanFile(abs);
    if (r.violations.length) violations.push(r);
  }
  return violations;
}

function runFixtures() {
  const metaFailures = [];
  const fixturesRoot = join(REPO_ROOT, "__fixtures__", "core-isolation");

  for (const kind of ["negative", "positive"]) {
    const dir = join(fixturesRoot, kind);
    let files = [];
    try {
      files = walk(dir);
    } catch {
      metaFailures.push(`missing fixture directory: __fixtures__/core-isolation/${kind}/`);
      continue;
    }
    // Only treat code files as fixtures (skip README.md etc.)
    files = files.filter((f) => SCAN_EXTS.has(f.slice(f.lastIndexOf("."))));
    if (!files.length)
      metaFailures.push(`no fixture files in __fixtures__/core-isolation/${kind}/`);
    for (const abs of files) {
      const src = readFileSync(abs, "utf8");
      const virtualPath = fixturePathHint(src);
      if (!virtualPath) {
        metaFailures.push(
          `fixture missing @as-if-path hint: ${relative(REPO_ROOT, abs)} (add "// @as-if-path: <zone>/..." near the top)`,
        );
        continue;
      }
      const r = scanFile(abs, virtualPath);
      if (kind === "negative" && r.violations.length === 0) {
        metaFailures.push(
          `fixture expected to FAIL but passed: ${r.file}  (add a real violation to make this fixture bite)`,
        );
      }
      if (kind === "positive" && r.violations.length > 0) {
        metaFailures.push(
          `fixture expected to PASS but failed: ${r.file}  — ${r.violations.join("; ")}`,
        );
      }
    }
  }
  return metaFailures;
}

const realViolations = runMainScan();
const metaFailures = runFixtures();

let exit = 0;

if (realViolations.length) {
  console.error("✗ core-isolation: violations in real code:");
  for (const r of realViolations) {
    console.error(`  ${r.file}`);
    for (const v of r.violations) console.error(`    - ${v}`);
  }
  exit = 1;
}

if (metaFailures.length) {
  console.error("✗ core-isolation: fixture meta-checks failed:");
  for (const m of metaFailures) console.error(`  - ${m}`);
  exit = 1;
}

if (!exit) {
  console.log("✓ core-isolation: all service-agnostic zones clean, fixtures behave as expected");
}

process.exit(exit);
