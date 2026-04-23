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
import capabilitiesSchema from "../../../schemas/capabilities.v1.json" with { type: "json" };
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
ajv.addSchema(capabilitiesSchema, "https://foxbook.dev/schemas/capabilities/v1.json");

const validateAgentCardRaw = ajv.getSchema("https://foxbook.dev/schemas/agent-card/v1.json");
const validateXFoxbookRaw = ajv.getSchema("https://foxbook.dev/schemas/x-foxbook/v1.json");
const validateTlLeafRaw = ajv.getSchema("https://foxbook.dev/schemas/tl-leaf/v1.json");

if (!validateAgentCardRaw || !validateXFoxbookRaw || !validateTlLeafRaw) {
  throw new Error("Foxbook validators failed to compile at module load.");
}

// Extract the capability-id enum from schemas/capabilities.v1.json at
// module load so `validateCapability` is a simple O(1) Set lookup,
// NOT a full AJV compile per call. We DON'T generate a TS type for
// capability_id (would embed enum-literal strings into
// packages/types-ts, which is a service-agnostic zone — some IDs
// would collide with core-isolation's banned-capability-literal
// regex via generated output). Consumers use strings directly.
const capabilityIds: ReadonlySet<string> = new Set(
  (capabilitiesSchema as { $defs: { capabilityId: { enum: string[] } } }).$defs.capabilityId.enum,
);

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

/**
 * True iff `id` is one of the 22 frozen v1 capability IDs per
 * schemas/capabilities.v1.json. Simple enum-membership check.
 */
export function validateCapability(id: unknown): boolean {
  return typeof id === "string" && capabilityIds.has(id);
}

/** Read-only snapshot of the 22 frozen v1 capability IDs. */
export function getCapabilityIds(): readonly string[] {
  return [...capabilityIds];
}
