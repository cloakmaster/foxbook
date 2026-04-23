"""RFC 9162 Merkle verify-only primitives.

V1 Python surface is intentionally narrow: scouts VERIFY inclusion and
consistency proofs they receive over the wire; they never generate
proofs or append leaves. The TS side (core/src/merkle) owns proof
generation + append; this module owns verify.

Parity is enforced by schemas/merkle-test-vectors.json — captured from
the TS impl, consumed by both test suites. If TS and Python disagree
about what a valid proof looks like for a given (index, tree_size,
leaf_hash, root) tuple, BOTH suites fail.
"""

from __future__ import annotations

import hashlib

LEAF_PREFIX = 0x00
INTERIOR_PREFIX = 0x01

EMPTY_TREE_ROOT = hashlib.sha256(b"").digest()


def leaf_hash(preimage: bytes) -> bytes:
    """SHA-256(0x00 || preimage) — RFC 9162 §2.1."""
    return hashlib.sha256(bytes([LEAF_PREFIX]) + preimage).digest()


def interior_hash(left: bytes, right: bytes) -> bytes:
    """SHA-256(0x01 || left || right). Both inputs must be 32 bytes."""
    if len(left) != 32 or len(right) != 32:
        raise ValueError(
            f"interior_hash expects two 32-byte inputs, got {len(left)} and {len(right)}"
        )
    return hashlib.sha256(bytes([INTERIOR_PREFIX]) + left + right).digest()


def _largest_pow2_less_than(n: int) -> int:
    if n < 2:
        raise ValueError(f"largest_pow2_less_than requires n >= 2, got {n}")
    k = 1
    while k * 2 < n:
        k *= 2
    return k


def _reconstruct_from_path(
    proof: list[bytes], m: int, leaf_hash_bytes: bytes, n: int
) -> bytes | None:
    if n == 1:
        return leaf_hash_bytes if len(proof) == 0 else None
    if len(proof) == 0:
        return None
    sibling = proof[-1]
    rest = proof[:-1]
    k = _largest_pow2_less_than(n)
    if m < k:
        left = _reconstruct_from_path(rest, m, leaf_hash_bytes, k)
        if left is None:
            return None
        return interior_hash(left, sibling)
    right = _reconstruct_from_path(rest, m - k, leaf_hash_bytes, n - k)
    if right is None:
        return None
    return interior_hash(sibling, right)


def verify_inclusion(
    proof: list[bytes],
    leaf_index: int,
    leaf_hash_bytes: bytes,
    tree_size: int,
    root: bytes,
) -> bool:
    """Verify an RFC 9162 inclusion proof. Returns True iff the
    reconstruction from (proof, index, leaf_hash, tree_size) equals
    the claimed root byte-for-byte.
    """
    if leaf_index < 0 or leaf_index >= tree_size:
        return False
    if tree_size == 0:
        return False
    reconstructed = _reconstruct_from_path(proof, leaf_index, leaf_hash_bytes, tree_size)
    return reconstructed is not None and reconstructed == root


def _is_pow2(x: int) -> bool:
    return x > 0 and (x & (x - 1)) == 0


def verify_consistency(
    proof: list[bytes],
    old_size: int,
    new_size: int,
    old_root: bytes,
    new_root: bytes,
) -> bool:
    """Verify an RFC 9162 consistency proof per §2.1.4.3.

    Reconstructs both old_root and new_root from `proof` and compares
    to the claimed roots byte-for-byte.
    """
    if old_size < 0 or new_size < 0:
        return False
    if old_size > new_size:
        return False
    if old_size == 0:
        return len(proof) == 0
    if old_size == new_size:
        return len(proof) == 0 and old_root == new_root

    p = [old_root, *proof] if _is_pow2(old_size) else list(proof)
    if len(p) == 0:
        return False

    fn = old_size - 1
    sn = new_size - 1
    while (fn & 1) == 1:
        fn >>= 1
        sn >>= 1

    fr: bytes = p[0]
    sr: bytes = p[0]
    rest = p[1:]

    for c in rest:
        if sn == 0:
            return False
        if (fn & 1) == 1 or fn == sn:
            fr = interior_hash(c, fr)
            sr = interior_hash(c, sr)
            while (fn & 1) == 0 and fn != 0:
                fn >>= 1
                sn >>= 1
        else:
            sr = interior_hash(sr, c)
        fn >>= 1
        sn >>= 1

    if sn != 0:
        return False
    return fr == old_root and sr == new_root
