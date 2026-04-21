// @as-if-path: packages/shared/src/bad.ts
// FIXTURE — must FAIL core-isolation. Closes the sneak path: core → packages/shared → x402.
// packages/** is in the service-agnostic zone, same as core/**.

// @ts-nocheck
import { verify } from "@sigstore/core";

export function reachesForSigstore() {
  return verify();
}
