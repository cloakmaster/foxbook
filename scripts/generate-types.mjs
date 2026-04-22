#!/usr/bin/env node

// Regenerates TS and Python types from schemas/*.
// Outputs:
//   packages/types-ts/src/envelope.ts
//   packages/types-ts/src/discover-response.ts
//   packages/types-py/src/foxbook_types/envelope.py
//   packages/types-py/src/foxbook_types/discover_response.py
//
// CI + pre-commit run `check-generated.mjs` which invokes this then diffs.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";
import { FetchingJSONSchemaStore, InputData, JSONSchemaInput, quicktype } from "quicktype-core";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

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
  });
  ensureDir(outAbs);
  writeFileSync(outAbs, headerTs(schemaPath) + compiled);
}

async function generatePython(schemaAbs, outAbs, topLevelName, schemaPath) {
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
  await schemaInput.addSource({
    name: topLevelName,
    schema: readFileSync(schemaAbs, "utf8"),
  });
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
