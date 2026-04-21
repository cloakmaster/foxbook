// @as-if-path: adapters/x402/src/good.ts
// FIXTURE — must PASS. Adapters are the ONLY zone where service-specific imports are legal.
// adapters/x402/ SHOULD import x402 — that's the point.

// @ts-nocheck
import { send } from "x402";

export function legallyWrapsX402() {
  return send();
}
