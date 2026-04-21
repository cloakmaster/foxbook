"""Ed25519 + JWS compact primitives, parity-tested with core/src/crypto.

Both impls read `schemas/crypto-test-vectors.json` and must produce byte-identical
outputs for the deterministic RFC 8032 vectors. Any divergence fails CI.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


@dataclass(frozen=True)
class Ed25519Keypair:
    """32-byte seed + 32-byte public key."""

    private_key: bytes
    public_key: bytes


def keypair_from_seed(seed: bytes) -> Ed25519Keypair:
    """Derive a keypair from a 32-byte seed. Deterministic per RFC 8032."""
    if len(seed) != 32:
        raise ValueError(f"Ed25519 seed must be 32 bytes, got {len(seed)}")
    sk = Ed25519PrivateKey.from_private_bytes(seed)
    pk_bytes = sk.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return Ed25519Keypair(private_key=seed, public_key=pk_bytes)


def generate_keypair() -> Ed25519Keypair:
    """Fresh random keypair. Use for signing keys; recovery keys follow the
    offline flow documented in docs/foundation/foxbook-foundation.md §6.6.
    """
    sk = Ed25519PrivateKey.generate()
    seed = sk.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return keypair_from_seed(seed)


def sign(message: bytes, private_key: bytes) -> bytes:
    """Ed25519 detached signature over `message` using the 32-byte seed."""
    sk = Ed25519PrivateKey.from_private_bytes(private_key)
    return sk.sign(message)


def verify(message: bytes, signature: bytes, public_key: bytes) -> bool:
    """Verify an Ed25519 signature. Returns True iff valid."""
    pk = Ed25519PublicKey.from_public_bytes(public_key)
    try:
        pk.verify(signature, message)
        return True
    except Exception:
        return False


# ---- JWS compact (RFC 7515) — EdDSA only ---------------------------------


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _canonical_json(obj: Any) -> bytes:
    """JSON encoding matched to core/src/crypto/jws.ts.

    TS uses `JSON.stringify(obj)` with default behaviour: no spaces, keys in
    insertion order, UTF-8 output. Python's `json.dumps(obj, separators=(",", ":"))`
    with `sort_keys=False` produces the same byte stream for the same Python dict
    whose insertion order matches the TS object literal.
    """
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def jws_sign(
    protected_header: dict[str, Any],
    payload: dict[str, Any],
    private_key: bytes,
) -> str:
    """Compact-JWS sign with EdDSA/Ed25519. Produces `header.payload.signature`."""
    if protected_header.get("alg") != "EdDSA":
        raise ValueError(f'jws_sign only supports alg="EdDSA", got {protected_header.get("alg")}')
    header_b64 = _b64url(_canonical_json(protected_header))
    payload_b64 = _b64url(_canonical_json(payload))
    signing_input = f"{header_b64}.{payload_b64}".encode()
    sig = sign(signing_input, private_key)
    return f"{header_b64}.{payload_b64}.{_b64url(sig)}"


@dataclass(frozen=True)
class JwsVerifyResult:
    valid: bool
    protected_header: dict[str, Any]
    payload: dict[str, Any]


def jws_verify(token: str, public_key: bytes) -> JwsVerifyResult:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError(f"JWS compact token must have 3 segments, got {len(parts)}")
    header_b64, payload_b64, sig_b64 = parts

    protected_header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
    if protected_header.get("alg") != "EdDSA":
        raise ValueError(f'jws_verify expected alg="EdDSA", got {protected_header.get("alg")}')
    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    sig = _b64url_decode(sig_b64)
    signing_input = f"{header_b64}.{payload_b64}".encode()
    valid = verify(signing_input, sig, public_key)
    return JwsVerifyResult(valid=valid, protected_header=protected_header, payload=payload)
