// RFC 9162 Merkle inclusion-proof verification — minimal subset
// inlined from @foxbook/core/merkle/tree.ts so this SDK is
// self-contained for npm publish.
//
// Why inlined: @foxbook/core is a private workspace package that
// won't ship to npm; if we kept it as a `workspace:*` dep, pnpm
// publish would rewrite the dep to "@foxbook/core": "0.0.0" and
// downstream `npm install` would fail with "package not found".
//
// Keep in sync with core/src/merkle/tree.ts (verifyInclusion +
// reconstructFromPath + largestPow2LessThan + bytesEqual) and
// core/src/merkle/hash.ts (interiorHash). The cross-language
// crypto-test-vectors.json fixture asserts byte-equality between
// the two implementations.

import { sha256 } from "@noble/hashes/sha2.js";

const INTERIOR_PREFIX = 0x01;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Largest power of 2 strictly less than n. RFC 9162 §2.1.1 definition of k. */
function largestPow2LessThan(n: number): number {
  if (n < 2) throw new Error(`largestPow2LessThan requires n >= 2, got ${n}`);
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/** SHA-256(0x01 || left || right). Both arguments must be 32 bytes. */
function interiorHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length !== 32 || right.length !== 32) {
    throw new Error(
      `interiorHash expects two 32-byte inputs, got ${left.length} and ${right.length}`,
    );
  }
  const buf = new Uint8Array(65);
  buf[0] = INTERIOR_PREFIX;
  buf.set(left, 1);
  buf.set(right, 33);
  return sha256(buf);
}

function reconstructFromPath(
  proof: Uint8Array[],
  m: number,
  leafHashBytes: Uint8Array,
  n: number,
): Uint8Array | null {
  if (n === 1) {
    if (proof.length !== 0) return null;
    return leafHashBytes;
  }
  const sibling = proof[proof.length - 1];
  if (!sibling) return null;
  const rest = proof.slice(0, -1);
  const k = largestPow2LessThan(n);
  if (m < k) {
    const left = reconstructFromPath(rest, m, leafHashBytes, k);
    if (left === null) return null;
    return interiorHash(left, sibling);
  }
  const right = reconstructFromPath(rest, m - k, leafHashBytes, n - k);
  if (right === null) return null;
  return interiorHash(sibling, right);
}

/**
 * Verify an RFC 9162 inclusion proof. Reconstructs the claimed root
 * from (proof, leafIndex, leafHashBytes, treeSize) and compares to
 * the asserted root byte-for-byte.
 */
export function verifyInclusion(
  proof: Uint8Array[],
  leafIndex: number,
  leafHashBytes: Uint8Array,
  treeSize: number,
  root: Uint8Array,
): boolean {
  if (leafIndex < 0 || leafIndex >= treeSize) return false;
  if (treeSize === 0) return false;
  const reconstructed = reconstructFromPath(proof, leafIndex, leafHashBytes, treeSize);
  return reconstructed !== null && bytesEqual(reconstructed, root);
}
