// SHA-256 helpers. core/merkle/hash.ts uses sha256 internally; this
// module exposes it for non-Merkle callers (recovery-key fingerprint
// matching, future content-addressed lookups). Single source of the
// hash primitive — service-agnostic, no DB.

import { sha256 } from "@noble/hashes/sha2.js";

/** SHA-256 of `input`, returned as raw 32 bytes. */
export function sha256Bytes(input: Uint8Array): Uint8Array {
  return sha256(input);
}

/** SHA-256 of `input`, returned as 64-char lowercase hex. */
export function sha256Hex(input: Uint8Array): string {
  const out = sha256(input);
  let s = "";
  for (let i = 0; i < out.length; i++) s += out[i]!.toString(16).padStart(2, "0");
  return s;
}
