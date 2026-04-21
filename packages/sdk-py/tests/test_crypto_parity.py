"""Parity with core/src/crypto against shared vectors. Any divergence fails CI."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from foxbook_sdk.crypto import (
    generate_keypair,
    jws_sign,
    jws_verify,
    keypair_from_seed,
    sign,
    verify,
)
from foxbook_sdk.did import (
    DID_PREFIX,
    did_to_ulid,
    is_did_foxbook,
    mint_did,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
VECTORS = json.loads((REPO_ROOT / "schemas" / "crypto-test-vectors.json").read_text())


@pytest.mark.parametrize("v", VECTORS["ed25519"], ids=lambda v: v["name"])
def test_ed25519_rfc8032_vector(v: dict) -> None:
    seed = bytes.fromhex(v["seed_hex"])
    message = bytes.fromhex(v["message_hex"])

    kp = keypair_from_seed(seed)
    assert kp.public_key.hex() == v["public_key_hex"]

    signature = sign(message, kp.private_key)
    assert signature.hex() == v["signature_hex"]

    assert verify(message, signature, kp.public_key) is True

    tampered = bytearray(signature)
    tampered[0] ^= 0x01
    assert verify(message, bytes(tampered), kp.public_key) is False


def test_generate_keypair_roundtrip() -> None:
    kp = generate_keypair()
    assert len(kp.private_key) == 32
    assert len(kp.public_key) == 32
    msg = b"hello"
    assert verify(msg, sign(msg, kp.private_key), kp.public_key) is True


def test_jws_round_trip_byte_equality() -> None:
    """Strongest parity check: Python token must equal the pinned expected token
    (which was captured from the TS impl). If this ever fails, TS and Python
    have drifted on header canonicalisation, b64url, or Ed25519 output."""
    v = VECTORS["jws_round_trip"]
    kp = keypair_from_seed(bytes.fromhex(v["seed_hex"]))
    token = jws_sign(v["protected_header"], v["payload"], kp.private_key)
    assert token == v["expected_token"]

    result = jws_verify(token, kp.public_key)
    assert result.valid is True
    assert result.protected_header == v["protected_header"]
    assert result.payload == v["payload"]


def test_jws_rejects_tampered_payload() -> None:
    v = VECTORS["jws_round_trip"]
    kp = keypair_from_seed(bytes.fromhex(v["seed_hex"]))
    token = jws_sign(v["protected_header"], v["payload"], kp.private_key)
    header_b64, _payload_b64, sig_b64 = token.split(".")
    import base64

    evil_payload = base64.urlsafe_b64encode(b'{"evil":true}').rstrip(b"=").decode()
    tampered = f"{header_b64}.{evil_payload}.{sig_b64}"
    assert jws_verify(tampered, kp.public_key).valid is False


def test_mint_did_format() -> None:
    did = mint_did()
    assert did.startswith(DID_PREFIX)
    assert is_did_foxbook(did)
    body = did_to_ulid(did)
    assert body is not None
    assert len(body) == 26


@pytest.mark.parametrize("good", VECTORS["did_foxbook"]["valid"])
def test_did_valid_vectors(good: str) -> None:
    assert is_did_foxbook(good) is True
    assert did_to_ulid(good) == good[len(DID_PREFIX) :]


@pytest.mark.parametrize("bad", VECTORS["did_foxbook"]["invalid"])
def test_did_invalid_vectors(bad: str) -> None:
    assert is_did_foxbook(bad) is False
    assert did_to_ulid(bad) is None
