# AUTO-GENERATED — do not hand-edit.
# Source: schemas/claim-by-handle.v1.json
# Regenerate via `pnpm generate:types`.
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Any, TypeVar, Type, cast


T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)


def from_str(x: Any) -> str:
    assert isinstance(x, str)
    return x


def from_bool(x: Any) -> bool:
    assert isinstance(x, bool)
    return x


def from_int(x: Any) -> int:
    assert isinstance(x, int) and not isinstance(x, bool)
    return x


def from_none(x: Any) -> Any:
    assert x is None
    return x


def from_union(fs, x):
    for f in fs:
        try:
            return f(x)
        except:
            pass
    assert False


def to_enum(c: Type[EnumT], x: Any) -> EnumT:
    assert isinstance(x, c)
    return x.value


def to_class(c: Type[T], x: Any) -> dict:
    assert isinstance(x, c)
    return cast(Any, x).to_dict()


class AssetType(Enum):
    DOMAIN = "domain"
    GITHUB_HANDLE = "github_handle"
    X_HANDLE = "x_handle"


class State(Enum):
    GIST_PENDING = "gist_pending"
    TIER1_VERIFIED = "tier1_verified"
    TIER2_PENDING = "tier2_pending"
    TIER2_VERIFIED = "tier2_verified"
    UNCLAIMED = "unclaimed"


@dataclass
class ClaimByHandle:
    """Read-only response shape for GET /api/v1/claim/by-handle/:asset_type/:asset_value.
    Returns the claim row + (when applicable) the latest agent-key-registration leaf index in
    the transparency log. Cache-Control: public, max-age=60, must-revalidate (per ADR 0007).
    """
    agent_did: str
    asset_type: AssetType
    asset_value: str
    ed25519_public_key_hex: str
    revoked: bool
    """Always false in v1 — revoked claims are deleted from the claims table per ADR 0004
    addendum-1, so a 200 response from this endpoint always describes a non-revoked claim.
    The field is surfaced for forward compatibility with a future soft-revoke path.
    """
    state: State
    verification_tier: int
    """0 = unclaimed/pending. 1 = tier1_verified (Gist). 2 = tier2_verified (DNS or endpoint).
    3+ reserved for future tiers.
    """
    inclusion_proof_url: Optional[str] = None
    """Convenience: the public Worker URL for the inclusion proof at leaf_index. Present only
    when leaf_index is present.
    """
    leaf_index: Optional[int] = None
    """Latest agent-key-registration leaf index in the transparency log. Present only when the
    claim is in tier1_verified or tier2_verified state.
    """

    @staticmethod
    def from_dict(obj: Any) -> 'ClaimByHandle':
        assert isinstance(obj, dict)
        agent_did = from_str(obj.get("agent_did"))
        asset_type = AssetType(obj.get("asset_type"))
        asset_value = from_str(obj.get("asset_value"))
        ed25519_public_key_hex = from_str(obj.get("ed25519_public_key_hex"))
        revoked = from_bool(obj.get("revoked"))
        state = State(obj.get("state"))
        verification_tier = from_int(obj.get("verification_tier"))
        inclusion_proof_url = from_union([from_str, from_none], obj.get("inclusion_proof_url"))
        leaf_index = from_union([from_int, from_none], obj.get("leaf_index"))
        return ClaimByHandle(agent_did, asset_type, asset_value, ed25519_public_key_hex, revoked, state, verification_tier, inclusion_proof_url, leaf_index)

    def to_dict(self) -> dict:
        result: dict = {}
        result["agent_did"] = from_str(self.agent_did)
        result["asset_type"] = to_enum(AssetType, self.asset_type)
        result["asset_value"] = from_str(self.asset_value)
        result["ed25519_public_key_hex"] = from_str(self.ed25519_public_key_hex)
        result["revoked"] = from_bool(self.revoked)
        result["state"] = to_enum(State, self.state)
        result["verification_tier"] = from_int(self.verification_tier)
        if self.inclusion_proof_url is not None:
            result["inclusion_proof_url"] = from_union([from_str, from_none], self.inclusion_proof_url)
        if self.leaf_index is not None:
            result["leaf_index"] = from_union([from_int, from_none], self.leaf_index)
        return result


def claim_by_handle_from_dict(s: Any) -> ClaimByHandle:
    return ClaimByHandle.from_dict(s)


def claim_by_handle_to_dict(x: ClaimByHandle) -> Any:
    return to_class(ClaimByHandle, x)

