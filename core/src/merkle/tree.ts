// RFC 9162 binary Merkle tree — tree math only. No storage, no signing.
//
// The TreeState here is the right-edge state: an ordered list of
// complete-subtree hashes maintained so that `appendLeaf` runs in
// O(log n) time and O(log n) space per call (size = popcount(n)). This
// is the single piece of state the Merkle repository caches on
// `transparency_log.right_edge` to avoid replaying the whole leaf list
// on every append.
//
// Proof generation (`inclusionProof`, `consistencyProof`) takes the
// full leaves list — the repository reads leaves from `tl_leaves` at
// proof time. Proof generation is O(n), but it runs off the hot append
// path and the auditor-facing latency of proof queries is the concern,
// not inserts/sec.
//
// Verification (`verifyInclusion`, `verifyConsistency`) reconstructs
// the claimed root from (proof, index-or-size, leafHash-or-oldRoot)
// and compares byte-for-byte to the asserted root. Scouts use these.

import { EMPTY_TREE_ROOT, interiorHash, leafHash } from "./hash.js";

/** A complete subtree in the right-edge stack. height=0 is a leaf. */
export type RightEdgeEntry = { hash: Uint8Array; height: number };

/** Persistable tree state, cached as jsonb on transparency_log.right_edge. */
export type TreeState = {
  rightEdge: RightEdgeEntry[];
  leafCount: number;
};

export function emptyTree(): TreeState {
  return { rightEdge: [], leafCount: 0 };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Fold the right-edge stack into a single root. O(log n). */
function foldRoot(rightEdge: RightEdgeEntry[]): Uint8Array {
  if (rightEdge.length === 0) return EMPTY_TREE_ROOT;
  // Walk right-to-left. Each index is in-bounds by construction — the
  // `?? EMPTY_TREE_ROOT` is unreachable but satisfies strict typing
  // without a non-null assertion.
  let acc: Uint8Array = rightEdge[rightEdge.length - 1]?.hash ?? EMPTY_TREE_ROOT;
  for (let i = rightEdge.length - 2; i >= 0; i--) {
    const left = rightEdge[i]?.hash ?? EMPTY_TREE_ROOT;
    acc = interiorHash(left, acc);
  }
  return acc;
}

/** Largest power of 2 strictly less than n. RFC 9162 §2.1.1 definition of k. */
function largestPow2LessThan(n: number): number {
  if (n < 2) throw new Error(`largestPow2LessThan requires n >= 2, got ${n}`);
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/**
 * Append a leaf to the tree. Returns the new state (caller persists) and
 * the new root (caller signs into an STH). Runs in O(log n) time.
 */
export function appendLeaf(
  state: TreeState,
  preimage: Uint8Array,
): {
  state: TreeState;
  leafHash: Uint8Array;
  leafIndex: number;
  rootAfter: Uint8Array;
} {
  const lh = leafHash(preimage);
  let h = lh;
  let height = 0;
  const next: RightEdgeEntry[] = [...state.rightEdge];
  // While the top of the stack is a complete subtree of the same height
  // as our new one, merge them into a height+1 subtree.
  while (next.length > 0 && next[next.length - 1]?.height === height) {
    const top = next.pop();
    if (!top) break;
    h = interiorHash(top.hash, h);
    height += 1;
  }
  next.push({ hash: h, height });
  return {
    state: { rightEdge: next, leafCount: state.leafCount + 1 },
    leafHash: lh,
    leafIndex: state.leafCount,
    rootAfter: foldRoot(next),
  };
}

/**
 * MTH(D[n]) per RFC 9162 §2.1.1. Computed from the full leaves list
 * — used for independent-verification tests and for reconstructing
 * subtree hashes during proof generation.
 */
export function mth(leaves: Uint8Array[]): Uint8Array {
  if (leaves.length === 0) return EMPTY_TREE_ROOT;
  const first = leaves[0];
  if (leaves.length === 1) {
    if (!first) throw new Error("unreachable: single-leaf tree with undefined leaf");
    return leafHash(first);
  }
  const k = largestPow2LessThan(leaves.length);
  return interiorHash(mth(leaves.slice(0, k)), mth(leaves.slice(k)));
}

/**
 * PATH(m, D[n]) per RFC 9162 §2.1.3.1. Returns the ordered sibling
 * hashes from the leaf's immediate parent up to the root. Length =
 * ceil(log2(n)) for indices in a full tree (shorter for tail indices
 * in sparse trees).
 */
export function inclusionProof(leaves: Uint8Array[], index: number): Uint8Array[] {
  const n = leaves.length;
  if (index < 0 || index >= n) {
    throw new Error(`inclusion proof index out of range: ${index} not in [0, ${n})`);
  }
  return pathRecursive(index, leaves);
}

function pathRecursive(m: number, d: Uint8Array[]): Uint8Array[] {
  const n = d.length;
  if (n === 1) return [];
  const k = largestPow2LessThan(n);
  if (m < k) {
    // Leaf is on the left side; sibling is the right subtree's root.
    return [...pathRecursive(m, d.slice(0, k)), mth(d.slice(k))];
  }
  // Leaf is on the right side; sibling is the left subtree's root.
  return [...pathRecursive(m - k, d.slice(k)), mth(d.slice(0, k))];
}

/**
 * Verify an inclusion proof. Reconstructs the claimed tree root from
 * the proof + leaf + index + tree size and compares to the asserted
 * root. Returns true iff the reconstruction matches.
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

function reconstructFromPath(
  proof: Uint8Array[],
  m: number,
  leafHashBytes: Uint8Array,
  n: number,
): Uint8Array | null {
  if (n === 1) {
    // Single-leaf tree: proof must be empty and leafHash IS the root.
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
 * PROOF(m, D[n]) per RFC 9162 §2.1.4.2 — proof that the first m leaves
 * of D are a prefix of D[n]. For m == 0 or m == n the proof is empty.
 */
export function consistencyProof(leaves: Uint8Array[], m: number): Uint8Array[] {
  const n = leaves.length;
  if (m < 0 || m > n) {
    throw new Error(`consistency proof m out of range: ${m} not in [0, ${n}]`);
  }
  if (m === 0 || m === n) return [];
  return subProof(m, leaves, true);
}

function subProof(m: number, d: Uint8Array[], b: boolean): Uint8Array[] {
  const n = d.length;
  if (m === n) {
    // RFC 9162: SUBPROOF(n, D[n], true) = []; SUBPROOF(n, D[n], false) = [MTH(D[n])].
    return b ? [] : [mth(d)];
  }
  const k = largestPow2LessThan(n);
  if (m <= k) {
    // Proof lives in the left subtree; sibling is the right subtree's root.
    return [...subProof(m, d.slice(0, k), b), mth(d.slice(k))];
  }
  // Proof straddles both: recurse into the right subtree with b=false,
  // sibling is the left subtree's root.
  return [...subProof(m - k, d.slice(k), false), mth(d.slice(0, k))];
}

/**
 * Verify a consistency proof per RFC 9162 §2.1.4.3. Reconstructs both
 * the old root (first m leaves) and the new root (first n leaves) from
 * the proof + the two roots, and asserts both match the claimed roots.
 */
export function verifyConsistency(
  proof: Uint8Array[],
  m: number,
  n: number,
  oldRoot: Uint8Array,
  newRoot: Uint8Array,
): boolean {
  if (m < 0 || n < 0) return false;
  if (m > n) return false;
  if (m === 0) {
    // Empty old tree is trivially a prefix; proof must be empty and
    // old_root should be the empty-tree root, but we don't enforce
    // old_root here (callers who care check it).
    return proof.length === 0;
  }
  if (m === n) {
    return proof.length === 0 && bytesEqual(oldRoot, newRoot);
  }
  // The §2.1.4.3 reconstruction: if m is a power of 2 and m is exactly
  // the "frontier" of the old tree, the first hash of the old subtree
  // is the old_root itself — the SUBPROOF recursion dropped it, so we
  // re-insert it here at the head of the traversal.
  let p = proof;
  if (isPow2(m)) {
    p = [oldRoot, ...proof];
  }
  if (p.length === 0) return false;

  let fn = m - 1;
  let sn = n - 1;
  while ((fn & 1) === 1) {
    fn >>= 1;
    sn >>= 1;
  }

  const head = p[0];
  if (!head) return false;
  let fr: Uint8Array = head;
  let sr: Uint8Array = head;
  const rest = p.slice(1);

  for (const c of rest) {
    if (sn === 0) return false;
    if ((fn & 1) === 1 || fn === sn) {
      fr = interiorHash(c, fr);
      sr = interiorHash(c, sr);
      // Walk up levels while we're still the right-most.
      while ((fn & 1) === 0 && fn !== 0) {
        fn >>= 1;
        sn >>= 1;
      }
    } else {
      sr = interiorHash(sr, c);
    }
    fn >>= 1;
    sn >>= 1;
  }
  if (sn !== 0) return false;
  return bytesEqual(fr, oldRoot) && bytesEqual(sr, newRoot);
}

function isPow2(x: number): boolean {
  return x > 0 && (x & (x - 1)) === 0;
}
