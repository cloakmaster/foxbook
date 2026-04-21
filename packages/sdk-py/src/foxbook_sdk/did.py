"""did:foxbook: — time-ordered ULID DIDs. Parity-tested with core/src/did.ts."""

from __future__ import annotations

import re

from ulid import ULID

DID_PREFIX = "did:foxbook:"
_DID_REGEX = re.compile(r"^did:foxbook:[0-9A-HJKMNP-TV-Z]{26}$")


def mint_did() -> str:
    """Mint a fresh did:foxbook:{ulid}. Time-ordered, sortable."""
    return f"{DID_PREFIX}{ULID()}"


def did_to_ulid(did: str) -> str | None:
    """Extract the ULID body, or None if the DID is malformed."""
    if not _DID_REGEX.match(did):
        return None
    return did[len(DID_PREFIX) :]


def is_did_foxbook(s: str) -> bool:
    return bool(_DID_REGEX.match(s))
