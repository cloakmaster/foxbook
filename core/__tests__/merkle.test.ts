import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";
import {
  appendLeaf,
  consistencyProof,
  consistencyProofFromLeafHashes,
  EMPTY_TREE_ROOT,
  emptyTree,
  INTERIOR_PREFIX,
  inclusionProof,
  inclusionProofFromLeafHashes,
  interiorHash,
  LEAF_PREFIX,
  leafHash,
  mth,
  mthFromLeafHashes,
  verifyConsistency,
  verifyInclusion,
} from "../src/merkle/index.js";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("Merkle — prefix bytes + empty tree (RFC 9162 §2.1)", () => {
  it("LEAF_PREFIX is 0x00 and INTERIOR_PREFIX is 0x01", () => {
    // If these constants ever flip, every downstream hash silently
    // diverges from every CT auditor on the planet. Pin them.
    expect(LEAF_PREFIX).toBe(0x00);
    expect(INTERIOR_PREFIX).toBe(0x01);
  });

  it("empty-tree root = SHA-256(empty)", () => {
    // Well-known SHA-256 of zero-byte input.
    expect(hex(EMPTY_TREE_ROOT)).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    // mth([]) must also return the empty-tree root.
    expect(hex(mth([]))).toBe(hex(EMPTY_TREE_ROOT));
  });

  it("leafHash of empty preimage = SHA-256(0x00) — the canonical single-byte hash", () => {
    expect(hex(leafHash(new Uint8Array()))).toBe(
      "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
    );
  });

  it("leafHash prepends 0x00 to the preimage before SHA-256", () => {
    const pre = bytes("hello");
    const withPrefix = new Uint8Array(1 + pre.length);
    withPrefix[0] = 0x00;
    withPrefix.set(pre, 1);
    expect(hex(leafHash(pre))).toBe(hex(sha256(withPrefix)));
  });

  it("interiorHash prepends 0x01 to (left || right) before SHA-256", () => {
    const left = leafHash(bytes("a"));
    const right = leafHash(bytes("b"));
    const withPrefix = new Uint8Array(1 + 32 + 32);
    withPrefix[0] = 0x01;
    withPrefix.set(left, 1);
    withPrefix.set(right, 33);
    expect(hex(interiorHash(left, right))).toBe(hex(sha256(withPrefix)));
  });

  it("prefix-swap negative: using 0x01 for a leaf diverges from leafHash", () => {
    const wrong = new Uint8Array(1 + 1);
    wrong[0] = 0x01;
    wrong.set(bytes("a"), 1);
    expect(hex(leafHash(bytes("a")))).not.toBe(hex(sha256(wrong)));
  });

  it("interiorHash rejects non-32-byte inputs", () => {
    const a = new Uint8Array(32);
    const b = new Uint8Array(31);
    expect(() => interiorHash(a, b)).toThrow();
    expect(() => interiorHash(b, a)).toThrow();
  });
});

describe("Merkle — MTH recursion (RFC 9162 §2.1.1)", () => {
  it("mth([a]) = leafHash(a)", () => {
    expect(hex(mth([bytes("a")]))).toBe(hex(leafHash(bytes("a"))));
  });

  it("mth([a, b]) = interiorHash(H(a), H(b))", () => {
    expect(hex(mth([bytes("a"), bytes("b")]))).toBe(
      hex(interiorHash(leafHash(bytes("a")), leafHash(bytes("b")))),
    );
  });

  it("mth([a, b, c]) splits at k=2: interiorHash(mth([a,b]), mth([c]))", () => {
    const expected = interiorHash(mth([bytes("a"), bytes("b")]), mth([bytes("c")]));
    expect(hex(mth([bytes("a"), bytes("b"), bytes("c")]))).toBe(hex(expected));
  });

  it("mth([0..6]) splits at k=4 (largest power of 2 < 7)", () => {
    const leaves = Array.from({ length: 7 }, (_, i) => bytes(String(i)));
    const expected = interiorHash(mth(leaves.slice(0, 4)), mth(leaves.slice(4)));
    expect(hex(mth(leaves))).toBe(hex(expected));
  });

  it("mth([0..7]) splits at k=4 for powers of 2", () => {
    const leaves = Array.from({ length: 8 }, (_, i) => bytes(String(i)));
    const expected = interiorHash(mth(leaves.slice(0, 4)), mth(leaves.slice(4)));
    expect(hex(mth(leaves))).toBe(hex(expected));
  });
});

describe("Merkle — appendLeaf (O(log n) right-edge incremental)", () => {
  it("empty tree + appendLeaf: leafIndex=0, root = leafHash(preimage)", () => {
    const leaf = bytes("0");
    const { state, leafIndex, rootAfter, leafHash: lh } = appendLeaf(emptyTree(), leaf);
    expect(leafIndex).toBe(0);
    expect(state.leafCount).toBe(1);
    expect(hex(rootAfter)).toBe(hex(leafHash(leaf)));
    expect(hex(lh)).toBe(hex(leafHash(leaf)));
  });

  it("N sequential appends produce the same root as mth([0..N-1]) for N=1..16", () => {
    for (let n = 1; n <= 16; n++) {
      let s = emptyTree();
      const leaves: Uint8Array[] = [];
      let lastRoot: Uint8Array | null = null;
      for (let i = 0; i < n; i++) {
        const leaf = bytes(String(i));
        leaves.push(leaf);
        const r = appendLeaf(s, leaf);
        s = r.state;
        lastRoot = r.rootAfter;
        expect(r.leafIndex).toBe(i);
      }
      expect(hex(lastRoot!)).toBe(hex(mth(leaves)));
      expect(s.leafCount).toBe(n);
    }
  });

  it("right-edge size is O(log2(leafCount)): popcount(n) entries after n appends", () => {
    let s = emptyTree();
    for (let i = 1; i <= 128; i++) {
      s = appendLeaf(s, bytes(String(i - 1))).state;
      // popcount(i) = number of 1-bits in binary representation of i.
      let pop = 0;
      for (let x = i; x > 0; x >>>= 1) pop += x & 1;
      expect(s.rightEdge.length).toBe(pop);
    }
  });
});

describe("Merkle — inclusion proofs (PATH from RFC 9162 §2.1.3.1)", () => {
  it("round-trip: for n=1..16, every index verifies", () => {
    for (let n = 1; n <= 16; n++) {
      const leaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const root = mth(leaves);
      for (let i = 0; i < n; i++) {
        const proof = inclusionProof(leaves, i);
        const lh = leafHash(leaves[i]!);
        expect(verifyInclusion(proof, i, lh, n, root)).toBe(true);
      }
    }
  });

  it("n=1 (single-leaf tree): inclusion proof is empty", () => {
    const leaves = [bytes("only")];
    expect(inclusionProof(leaves, 0)).toHaveLength(0);
    expect(verifyInclusion([], 0, leafHash(bytes("only")), 1, mth(leaves))).toBe(true);
  });

  it("tampered leafHash fails verification", () => {
    const leaves = [bytes("0"), bytes("1"), bytes("2"), bytes("3")];
    const root = mth(leaves);
    const proof = inclusionProof(leaves, 2);
    const wrong = new Uint8Array(leafHash(leaves[2]!));
    wrong[0] ^= 0x01;
    expect(verifyInclusion(proof, 2, wrong, 4, root)).toBe(false);
  });

  it("tampered proof element fails verification", () => {
    const leaves = [bytes("0"), bytes("1"), bytes("2"), bytes("3")];
    const root = mth(leaves);
    const proof = inclusionProof(leaves, 1);
    const tampered = proof.map((p) => new Uint8Array(p));
    if (tampered[0]) tampered[0][0] ^= 0x01;
    expect(verifyInclusion(tampered, 1, leafHash(leaves[1]!), 4, root)).toBe(false);
  });

  it("wrong tree size fails verification", () => {
    const leaves = [bytes("0"), bytes("1"), bytes("2"), bytes("3")];
    const root = mth(leaves);
    const proof = inclusionProof(leaves, 1);
    expect(verifyInclusion(proof, 1, leafHash(leaves[1]!), 5, root)).toBe(false);
  });

  it("out-of-range index throws on proof generation", () => {
    const leaves = [bytes("0"), bytes("1")];
    expect(() => inclusionProof(leaves, 2)).toThrow();
    expect(() => inclusionProof(leaves, -1)).toThrow();
  });
});

describe("Merkle — consistency proofs (PROOF from RFC 9162 §2.1.4.2)", () => {
  it("round-trip for every (m, n) with 0 ≤ m ≤ n ≤ 8", () => {
    for (let n = 0; n <= 8; n++) {
      const newLeaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const newRoot = mth(newLeaves);
      for (let m = 0; m <= n; m++) {
        const oldRoot = mth(newLeaves.slice(0, m));
        const proof = consistencyProof(newLeaves, m);
        expect(verifyConsistency(proof, m, n, oldRoot, newRoot)).toBe(true);
      }
    }
  });

  it("m=0: proof is empty, verify accepts any old_root (vacuous)", () => {
    const newLeaves = [bytes("0"), bytes("1"), bytes("2")];
    const newRoot = mth(newLeaves);
    expect(consistencyProof(newLeaves, 0)).toHaveLength(0);
    expect(verifyConsistency([], 0, 3, EMPTY_TREE_ROOT, newRoot)).toBe(true);
  });

  it("m=n: proof is empty, roots must match", () => {
    const leaves = [bytes("0"), bytes("1"), bytes("2")];
    const root = mth(leaves);
    expect(consistencyProof(leaves, 3)).toHaveLength(0);
    expect(verifyConsistency([], 3, 3, root, root)).toBe(true);
  });

  it("m > n: verify rejects", () => {
    expect(verifyConsistency([], 5, 3, EMPTY_TREE_ROOT, EMPTY_TREE_ROOT)).toBe(false);
  });

  it("tampered old_root fails verification", () => {
    const leaves = [bytes("0"), bytes("1"), bytes("2"), bytes("3"), bytes("4")];
    const oldRoot = mth(leaves.slice(0, 2));
    const newRoot = mth(leaves);
    const proof = consistencyProof(leaves, 2);
    const bogus = new Uint8Array(oldRoot);
    bogus[0] ^= 0x01;
    expect(verifyConsistency(proof, 2, 5, bogus, newRoot)).toBe(false);
  });

  it("tampered new_root fails verification", () => {
    const leaves = [bytes("0"), bytes("1"), bytes("2"), bytes("3"), bytes("4")];
    const oldRoot = mth(leaves.slice(0, 2));
    const newRoot = mth(leaves);
    const proof = consistencyProof(leaves, 2);
    const bogus = new Uint8Array(newRoot);
    bogus[0] ^= 0x01;
    expect(verifyConsistency(proof, 2, 5, oldRoot, bogus)).toBe(false);
  });
});

describe("Merkle — committed test vectors (schemas/merkle-test-vectors.json)", () => {
  // Cross-language parity surface. These vectors are generated by the
  // TS impl (ops/scripts/capture-merkle-vectors.mjs), committed to the
  // repo, and consumed by both TS tests (as a drift check) and the
  // Python verifier (as the authoritative ground truth).
  type MerkleVectors = {
    $comment: string;
    empty_tree_root_hex: string;
    leaf_empty_input_hex: string;
    inclusion: Array<{
      leaves: string[];
      leaf_index: number;
      proof_hex: string[];
      root_hex: string;
    }>;
    consistency: Array<{
      leaves: string[];
      m: number;
      n: number;
      proof_hex: string[];
      old_root_hex: string;
      new_root_hex: string;
    }>;
  };
  const VECTORS_PATH = fileURLToPath(
    new URL("../../schemas/merkle-test-vectors.json", import.meta.url),
  );
  const vectors = JSON.parse(readFileSync(VECTORS_PATH, "utf8")) as MerkleVectors;

  it("empty_tree_root_hex in vectors matches EMPTY_TREE_ROOT", () => {
    expect(vectors.empty_tree_root_hex).toBe(hex(EMPTY_TREE_ROOT));
  });

  it("leaf_empty_input_hex matches leafHash(new Uint8Array())", () => {
    expect(vectors.leaf_empty_input_hex).toBe(hex(leafHash(new Uint8Array())));
  });

  it("every inclusion vector verifies", () => {
    expect(vectors.inclusion.length).toBeGreaterThan(0);
    for (const v of vectors.inclusion) {
      const leaves = v.leaves.map((s) => bytes(s));
      const proof = v.proof_hex.map((h) => fromHex(h));
      const lh = leafHash(leaves[v.leaf_index]!);
      const root = fromHex(v.root_hex);
      expect(verifyInclusion(proof, v.leaf_index, lh, leaves.length, root)).toBe(true);
      // Also reproduce the proof + root locally (drift guard)
      expect(v.proof_hex).toEqual(inclusionProof(leaves, v.leaf_index).map((p) => hex(p)));
      expect(v.root_hex).toBe(hex(mth(leaves)));
    }
  });

  it("every consistency vector verifies", () => {
    expect(vectors.consistency.length).toBeGreaterThan(0);
    for (const v of vectors.consistency) {
      const leaves = v.leaves.map((s) => bytes(s));
      const proof = v.proof_hex.map((h) => fromHex(h));
      const oldRoot = fromHex(v.old_root_hex);
      const newRoot = fromHex(v.new_root_hex);
      expect(verifyConsistency(proof, v.m, v.n, oldRoot, newRoot)).toBe(true);
      // Drift guard
      expect(v.proof_hex).toEqual(consistencyProof(leaves, v.m).map((p) => hex(p)));
      expect(v.old_root_hex).toBe(hex(mth(leaves.slice(0, v.m))));
      expect(v.new_root_hex).toBe(hex(mth(leaves)));
    }
  });
});

function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

describe("Merkle — *FromLeafHashes variants (read-path without re-hashing)", () => {
  // These variants skip the leaf-hash step at the base case; the rest of
  // the tree math is identical to the preimage-taking variants. Tests
  // verify the two paths agree when fed consistent inputs.

  it("mthFromLeafHashes([]) = EMPTY_TREE_ROOT", () => {
    expect(hex(mthFromLeafHashes([]))).toBe(hex(EMPTY_TREE_ROOT));
  });

  it("mthFromLeafHashes([h]) = h (single leaf, no wrapping leafHash call)", () => {
    const h = leafHash(bytes("only"));
    expect(hex(mthFromLeafHashes([h]))).toBe(hex(h));
    // mth(preimages) === mthFromLeafHashes(hashes) for the same data
    expect(hex(mth([bytes("only")]))).toBe(hex(mthFromLeafHashes([h])));
  });

  it("mth(leaves) === mthFromLeafHashes(leaves.map(leafHash)) for N=1..16", () => {
    for (let n = 1; n <= 16; n++) {
      const leaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const hashes = leaves.map((l) => leafHash(l));
      expect(hex(mth(leaves))).toBe(hex(mthFromLeafHashes(hashes)));
    }
  });

  it("inclusionProofFromLeafHashes produces identical proof bytes for every index", () => {
    for (let n = 1; n <= 8; n++) {
      const leaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const hashes = leaves.map((l) => leafHash(l));
      for (let i = 0; i < n; i++) {
        const fromPreimages = inclusionProof(leaves, i).map(hex);
        const fromHashes = inclusionProofFromLeafHashes(hashes, i).map(hex);
        expect(fromHashes).toEqual(fromPreimages);
      }
    }
  });

  it("inclusionProofFromLeafHashes proofs still verify via verifyInclusion", () => {
    for (let n = 1; n <= 8; n++) {
      const leaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const hashes = leaves.map((l) => leafHash(l));
      const root = mthFromLeafHashes(hashes);
      for (let i = 0; i < n; i++) {
        const proof = inclusionProofFromLeafHashes(hashes, i);
        expect(verifyInclusion(proof, i, hashes[i]!, n, root)).toBe(true);
      }
    }
  });

  it("consistencyProofFromLeafHashes produces identical proof bytes for every (m, n)", () => {
    for (let n = 0; n <= 8; n++) {
      const leaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const hashes = leaves.map((l) => leafHash(l));
      for (let m = 0; m <= n; m++) {
        const fromPreimages = consistencyProof(leaves, m).map(hex);
        const fromHashes = consistencyProofFromLeafHashes(hashes, m).map(hex);
        expect(fromHashes).toEqual(fromPreimages);
      }
    }
  });

  it("consistencyProofFromLeafHashes proofs still verify via verifyConsistency", () => {
    for (let n = 1; n <= 8; n++) {
      const leaves = Array.from({ length: n }, (_, i) => bytes(String(i)));
      const hashes = leaves.map((l) => leafHash(l));
      const newRoot = mthFromLeafHashes(hashes);
      for (let m = 0; m <= n; m++) {
        const oldRoot = mthFromLeafHashes(hashes.slice(0, m));
        const proof = consistencyProofFromLeafHashes(hashes, m);
        expect(verifyConsistency(proof, m, n, oldRoot, newRoot)).toBe(true);
      }
    }
  });

  it("out-of-range index throws on FromLeafHashes variants", () => {
    const hashes = [leafHash(bytes("a")), leafHash(bytes("b"))];
    expect(() => inclusionProofFromLeafHashes(hashes, 2)).toThrow();
    expect(() => inclusionProofFromLeafHashes(hashes, -1)).toThrow();
    expect(() => consistencyProofFromLeafHashes(hashes, 3)).toThrow();
    expect(() => consistencyProofFromLeafHashes(hashes, -1)).toThrow();
  });
});
