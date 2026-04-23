// Foxbook manifest validators: A2A AgentCard (pinned to v0.3.0) and the
// x-foxbook extension, plus the v0 transparency-log leaf taxonomy. Pure,
// no DB dependency — consumed by scraper, discovery, claim flow, and
// (internally) the Merkle repository.
//
// Uses AJV 2020 (draft 2020-12) in strict mode with ajv-formats (date-time,
// uri, etc.) and ajv-errors for human-readable messages keyed to schema
// nodes. All three schemas are registered at module load so cross-file
// $ref resolution is deterministic.

import type { ErrorObject } from "ajv";
// AJV + plugins ship as CJS. Under NodeNext, tsc sometimes types the
// default export as `typeof module-namespace` rather than the underlying
// class/function, so we reach for the runtime values via namespace
// imports and cast once at the seam. Ajv2020 has an explicit named
// `exports.Ajv2020`, so the named import is both the cleanest type and
// runtime shape.
import { Ajv2020 } from "ajv/dist/2020.js";
import * as ajvErrorsModule from "ajv-errors";
import * as addFormatsModule from "ajv-formats";

import agentCardSchema from "../../../schemas/agent-card.v1.json" with { type: "json" };
import tlLeafSchema from "../../../schemas/tl-leaf.v1.json" with { type: "json" };
import xFoxbookSchema from "../../../schemas/x-foxbook.v1.json" with { type: "json" };

type AjvInstance = InstanceType<typeof Ajv2020>;
const addFormats = addFormatsModule.default as unknown as (ajv: AjvInstance) => AjvInstance;
const ajvErrors = ajvErrorsModule.default as unknown as (ajv: AjvInstance) => AjvInstance;

export type ValidationError = {
  path: string;
  keyword: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  // Third-party A2A cards can include fields we haven't modelled yet.
  // Setting strict on keywords (we do) without disabling `additionalProperties`
  // coercion is the right balance: we reject unknown keywords in our own
  // schemas, while agent-card.v1.json intentionally omits top-level
  // additionalProperties for A2A forward-compat.
});
addFormats(ajv);
ajvErrors(ajv);

ajv.addSchema(xFoxbookSchema, "https://foxbook.dev/schemas/x-foxbook/v1.json");
ajv.addSchema(agentCardSchema, "https://foxbook.dev/schemas/agent-card/v1.json");
ajv.addSchema(tlLeafSchema, "https://foxbook.dev/schemas/tl-leaf/v1.json");

const validateAgentCardRaw = ajv.getSchema("https://foxbook.dev/schemas/agent-card/v1.json");
const validateXFoxbookRaw = ajv.getSchema("https://foxbook.dev/schemas/x-foxbook/v1.json");
const validateTlLeafRaw = ajv.getSchema("https://foxbook.dev/schemas/tl-leaf/v1.json");

if (!validateAgentCardRaw || !validateXFoxbookRaw || !validateTlLeafRaw) {
  throw new Error("Foxbook validators failed to compile at module load.");
}

function formatErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || "",
    keyword: e.keyword,
    message: e.message ?? "validation failed",
  }));
}

function run(fn: ReturnType<typeof ajv.getSchema>, input: unknown): ValidationResult {
  if (!fn) throw new Error("validator not compiled");
  const valid = fn(input);
  return { valid: valid === true, errors: valid === true ? [] : formatErrors(fn.errors) };
}

export function validateAgentCard(input: unknown): ValidationResult {
  return run(validateAgentCardRaw, input);
}

export function validateXFoxbook(input: unknown): ValidationResult {
  return run(validateXFoxbookRaw, input);
}

export function validateTlLeaf(input: unknown): ValidationResult {
  return run(validateTlLeafRaw, input);
}

/**
 * Combined validation: A2A base + optional x-foxbook. Mirrors what the
 * claim flow and scraper will call when they receive a manifest over the
 * wire.
 */
export function validateManifest(input: unknown): ValidationResult {
  return validateAgentCard(input);
}
