// SHA-256 primitives for RFC 9162 (CT v2) Merkle trees.
//
// RFC 9162 §2.1 distinguishes leaves and interior nodes by a single
// prefix byte to prevent second-preimage attacks:
//
//   leaf_hash(d)        = SHA-256(0x00 || d)
//   interior_hash(a, b) = SHA-256(0x01 || a || b)
//
// The empty-tree root is SHA-256 of zero bytes, which is the widely
// tabulated e3b0c442... constant. Our `mth([])` and the repository's
// `getRoot` on an empty log both return this.
//
// If the 0x00 / 0x01 prefix bytes are ever swapped, every downstream
// hash silently diverges from every existing CT auditor, every
// Sigstore/Rekor tool, and every piece of RFC 9162 tooling on the
// planet. The test suite pins this with a swap-negative vector.

import { sha256 } from "@noble/hashes/sha2.js";

export const LEAF_PREFIX = 0x00;
export const INTERIOR_PREFIX = 0x01;

/** RFC 9162 §2.1.1: MTH({}) = SHA-256 of the empty byte string. */
export const EMPTY_TREE_ROOT: Uint8Array = sha256(new Uint8Array(0));

/** SHA-256(0x00 || preimage). */
export function leafHash(preimage: Uint8Array): Uint8Array {
  const buf = new Uint8Array(1 + preimage.length);
  buf[0] = LEAF_PREFIX;
  buf.set(preimage, 1);
  return sha256(buf);
}

/** SHA-256(0x01 || left || right). Both arguments must be 32 bytes. */
export function interiorHash(left: Uint8Array, right: Uint8Array): Uint8Array {
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
