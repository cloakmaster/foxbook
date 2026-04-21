// @as-if-path: core/src/good.ts
// FIXTURE — must PASS. Core CAN import from packages/* (shared infrastructure like db, types, shield core).
// Both zones are service-agnostic, so this edge is safe.

import { schema } from "@foxbook/packages/db";
// @ts-nocheck
import type { Envelope } from "@foxbook/packages/types-ts";

export function legallyUsesSharedInfra(e: Envelope) {
  return schema.agents.findFirst(e);
}
