"""TS ↔ Python parity for Merkle verify-side primitives.

Reads schemas/merkle-test-vectors.json (captured from the TS impl) and
asserts that every committed (inclusion, consistency) vector verifies
under our Python impl. If this fails, either TS shifted and Python
didn't, or vice versa — either way, the cross-language covenant is
broken and no scout should be trusting proofs from this build.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from foxbook_sdk.merkle import (
    EMPTY_TREE_ROOT,
    INTERIOR_PREFIX,
    LEAF_PREFIX,
    interior_hash,
    leaf_hash,
    verify_consistency,
    verify_inclusion,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
VECTORS = json.loads((REPO_ROOT / "schemas" / "merkle-test-vectors.json").read_text())


def _bytes(s: str) -> bytes:
    return s.encode("utf-8")


def _fromhex(s: str) -> bytes:
    return bytes.fromhex(s)


def test_prefix_bytes() -> None:
    """Ed25519 RFC 9162 prefix bytes must match TS. If swapped, every
    downstream hash silently diverges."""
    assert LEAF_PREFIX == 0x00
    assert INTERIOR_PREFIX == 0x01


def test_empty_tree_root_matches_vectors() -> None:
    assert EMPTY_TREE_ROOT.hex() == VECTORS["empty_tree_root_hex"]


def test_leaf_empty_input_matches_vectors() -> None:
    assert leaf_hash(b"").hex() == VECTORS["leaf_empty_input_hex"]


def test_leaf_hash_prefix() -> None:
    """leaf_hash prepends 0x00; any other prefix must produce a different hash."""
    import hashlib

    assert leaf_hash(b"hello") == hashlib.sha256(b"\x00hello").digest()
    assert leaf_hash(b"hello") != hashlib.sha256(b"\x01hello").digest()


def test_interior_hash_rejects_non_32_byte() -> None:
    with pytest.raises(ValueError):
        interior_hash(b"\x00" * 32, b"\x00" * 31)
    with pytest.raises(ValueError):
        interior_hash(b"\x00" * 31, b"\x00" * 32)


@pytest.mark.parametrize(
    "v",
    VECTORS["inclusion"],
    ids=lambda v: f"n={len(v['leaves'])},i={v['leaf_index']}",
)
def test_inclusion_vector_verifies(v: dict) -> None:
    leaves = [_bytes(s) for s in v["leaves"]]
    proof = [_fromhex(h) for h in v["proof_hex"]]
    lh = leaf_hash(leaves[v["leaf_index"]])
    root = _fromhex(v["root_hex"])
    assert verify_inclusion(proof, v["leaf_index"], lh, len(leaves), root) is True


def test_tampered_inclusion_proof_rejects() -> None:
    """Pick a non-empty inclusion vector and flip one byte — must fail."""
    v = next(x for x in VECTORS["inclusion"] if len(x["proof_hex"]) > 0)
    leaves = [_bytes(s) for s in v["leaves"]]
    proof = [bytearray(_fromhex(h)) for h in v["proof_hex"]]
    proof[0][0] ^= 0x01  # flip one bit
    lh = leaf_hash(leaves[v["leaf_index"]])
    root = _fromhex(v["root_hex"])
    assert (
        verify_inclusion([bytes(p) for p in proof], v["leaf_index"], lh, len(leaves), root)
        is False
    )


@pytest.mark.parametrize(
    "v",
    VECTORS["consistency"],
    ids=lambda v: f"m={v['m']},n={v['n']}",
)
def test_consistency_vector_verifies(v: dict) -> None:
    proof = [_fromhex(h) for h in v["proof_hex"]]
    old_root = _fromhex(v["old_root_hex"])
    new_root = _fromhex(v["new_root_hex"])
    assert verify_consistency(proof, v["m"], v["n"], old_root, new_root) is True


def test_consistency_m_greater_than_n_rejects() -> None:
    assert verify_consistency([], 5, 3, EMPTY_TREE_ROOT, EMPTY_TREE_ROOT) is False


def test_consistency_tampered_old_root_rejects() -> None:
    """Pick a non-trivial (0 < m < n) vector, corrupt old_root, verify fails."""
    v = next(x for x in VECTORS["consistency"] if 0 < x["m"] < x["n"])
    proof = [_fromhex(h) for h in v["proof_hex"]]
    new_root = _fromhex(v["new_root_hex"])
    bogus = bytearray(_fromhex(v["old_root_hex"]))
    bogus[0] ^= 0x01
    assert verify_consistency(proof, v["m"], v["n"], bytes(bogus), new_root) is False
