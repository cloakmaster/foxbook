// @as-if-path: core/src/bad.ts
// FIXTURE — must FAIL core-isolation. Core imports from adapters/.

// @ts-nocheck — fixture is never typechecked
import { pay } from "../../adapters/x402/src/index";

export function runsInCore() {
  return pay();
}
