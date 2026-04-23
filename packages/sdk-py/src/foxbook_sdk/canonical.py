"""Canonical JSON encoding for signed payloads.

Mirror of core/src/crypto/canonical.ts. v1 rule: `json.dumps(obj,
separators=(",", ":"), ensure_ascii=False)` — no whitespace, keys in
insertion order, UTF-8 output. The same dict-insertion-order contract
as the TS side; when callers fix key order, cross-language byte parity
holds. Continuously asserted by schemas/crypto-test-vectors.json's
`jws_round_trip` vector.
"""

from __future__ import annotations

import json
from typing import Any


def canonical_json_bytes(obj: Any) -> bytes:
    """Canonical JSON bytes for JWS segments and Merkle leaf preimages."""
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
