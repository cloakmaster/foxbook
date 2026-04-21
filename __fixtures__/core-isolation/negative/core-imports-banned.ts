// @as-if-path: core/src/bad.ts
// FIXTURE — must FAIL core-isolation. Core imports a banned third-party identifier directly.

// @ts-nocheck
import { send } from "x402";

export function reachesForX402() {
  return send();
}
