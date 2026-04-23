#!/usr/bin/env node

// Regenerates TS and Python types from schemas/*.
// Outputs (8 files, 4 schemas × 2 languages):
//   packages/types-ts/src/envelope.ts
//   packages/types-ts/src/discover-response.ts
//   packages/types-ts/src/agent-card.ts
//   packages/types-ts/src/x-foxbook.ts
//   packages/types-py/src/foxbook_types/envelope.py
//   packages/types-py/src/foxbook_types/discover_response.py
//   packages/types-py/src/foxbook_types/agent_card.py
//   packages/types-py/src/foxbook_types/x_foxbook.py
//
// schemas/tl-leaf.v1.json is intentionally NOT generated — it's an
// internal taxonomy consumed only by the Merkle repo and the validator;
// it doesn't cross a TS/Python wire boundary.
//
// CI + pre-commit run `check-generated.mjs` which invokes this then diffs.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";
import { FetchingJSONSchemaStore, InputData, JSONSchemaInput, quicktype } from "quicktype-core";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

// Custom $ref resolver for `https://foxbook.dev/schemas/*` URLs. Our $id
// values are public URLs (so deployed artifacts can interop with external
// validators) but during codegen we must not touch the network. Map each
// $id URL to the committed file under schemas/.
const idToAbsPath = new Map();
const localHttpResolver = {
  order: 1,
  canRead: /^https?:\/\/foxbook\.dev\/schemas\//,
  read(file) {
    const abs = idToAbsPath.get(file.url);
    if (!abs) throw new Error(`unknown foxbook schema $ref: ${file.url}`);
    return readFileSync(abs, "utf8");
  },
};

const schemas = [
  {
    id: "envelope",
    schemaPath: "schemas/envelope/v1.json",
    tsOut: "packages/types-ts/src/envelope.ts",
    pyOut: "packages/types-py/src/foxbook_types/envelope.py",
    topLevelName: "Envelope",
  },
  {
    id: "discover-response",
    schemaPath: "schemas/discover-response.v1.json",
    tsOut: "packages/types-ts/src/discover-response.ts",
    pyOut: "packages/types-py/src/foxbook_types/discover_response.py",
    topLevelName: "DiscoverResponse",
  },
  {
    id: "x-foxbook",
    schemaPath: "schemas/x-foxbook.v1.json",
    tsOut: "packages/types-ts/src/x-foxbook.ts",
    pyOut: "packages/types-py/src/foxbook_types/x_foxbook.py",
    topLevelName: "XFoxbook",
  },
  {
    id: "agent-card",
    schemaPath: "schemas/agent-card.v1.json",
    tsOut: "packages/types-ts/src/agent-card.ts",
    pyOut: "packages/types-py/src/foxbook_types/agent_card.py",
    topLevelName: "AgentCard",
  },
];

function headerTs(schemaPath) {
  return [
    "// AUTO-GENERATED — do not hand-edit.",
    `// Source: ${schemaPath}`,
    "// Regenerate via `pnpm generate:types`.",
    "",
  ].join("\n");
}

function headerPy(schemaPath) {
  return [
    "# AUTO-GENERATED — do not hand-edit.",
    `# Source: ${schemaPath}`,
    "# Regenerate via `pnpm generate:types`.",
    "",
  ].join("\n");
}

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

async function generateTs(schemaAbs, outAbs, schemaPath) {
  const compiled = await compileFromFile(schemaAbs, {
    bannerComment: "",
    additionalProperties: false,
    style: { singleQuote: false, printWidth: 100 },
    $refOptions: { resolve: { http: localHttpResolver } },
  });
  ensureDir(outAbs);
  writeFileSync(outAbs, headerTs(schemaPath) + compiled);
}

// Quicktype's JSONSchemaInput needs every referenced schema registered
// as an addSource call — otherwise it will try to fetch external $refs.
// We add other schemas only when the current schema text mentions their
// `$id` (substring match on foxbook.dev URLs), so standalone schemas
// render in isolation and their output stays byte-stable across runs.
async function generatePython(schemaAbs, outAbs, topLevelName, schemaPath) {
  const schemaText = readFileSync(schemaAbs, "utf8");
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
  await schemaInput.addSource({ name: topLevelName, schema: schemaText });
  for (const other of schemas) {
    const otherAbs = join(REPO_ROOT, other.schemaPath);
    if (otherAbs === schemaAbs) continue;
    const otherText = readFileSync(otherAbs, "utf8");
    const otherId = JSON.parse(otherText).$id;
    if (!otherId || !schemaText.includes(otherId)) continue;
    await schemaInput.addSource({ name: other.topLevelName, schema: otherText });
  }
  const inputData = new InputData();
  inputData.addInput(schemaInput);

  const result = await quicktype({
    inputData,
    lang: "python",
    rendererOptions: { "python-version": "3.7" },
  });

  ensureDir(outAbs);
  writeFileSync(outAbs, headerPy(schemaPath) + result.lines.join("\n") + "\n");
}

async function main() {
  // Seed the $id → local path table so the HTTP resolver can short-circuit.
  for (const s of schemas) {
    const abs = join(REPO_ROOT, s.schemaPath);
    const parsed = JSON.parse(readFileSync(abs, "utf8"));
    if (parsed.$id) idToAbsPath.set(parsed.$id, abs);
  }

  for (const s of schemas) {
    const schemaAbs = join(REPO_ROOT, s.schemaPath);
    const tsAbs = join(REPO_ROOT, s.tsOut);
    const pyAbs = join(REPO_ROOT, s.pyOut);

    await generateTs(schemaAbs, tsAbs, s.schemaPath);
    await generatePython(schemaAbs, pyAbs, s.topLevelName, s.schemaPath);
    console.log(`✓ generated types from ${s.schemaPath}`);
    console.log(`    → ${s.tsOut}`);
    console.log(`    → ${s.pyOut}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
