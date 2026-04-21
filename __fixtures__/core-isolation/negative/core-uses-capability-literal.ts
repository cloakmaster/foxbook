// @as-if-path: core/src/bad.ts
// FIXTURE — must FAIL core-isolation. Core uses a banned capability literal.
// Capability names belong to adapters and scouts, not core.

// @ts-nocheck
export const CAPABILITY = "translation";
