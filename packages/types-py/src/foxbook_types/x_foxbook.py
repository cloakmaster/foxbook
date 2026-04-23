# AUTO-GENERATED — do not hand-edit.
# Source: schemas/x-foxbook.v1.json
# Regenerate via `pnpm generate:types`.
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Any, List, Dict, TypeVar, Type, Callable, cast
from datetime import datetime
import dateutil.parser


T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)


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


def from_str(x: Any) -> str:
    assert isinstance(x, str)
    return x


def from_datetime(x: Any) -> datetime:
    return dateutil.parser.parse(x)


def to_enum(c: Type[EnumT], x: Any) -> EnumT:
    assert isinstance(x, c)
    return x.value


def from_float(x: Any) -> float:
    assert isinstance(x, (float, int)) and not isinstance(x, bool)
    return float(x)


def to_float(x: Any) -> float:
    assert isinstance(x, (int, float))
    return x


def from_list(f: Callable[[Any], T], x: Any) -> List[T]:
    assert isinstance(x, list)
    return [f(y) for y in x]


def from_bool(x: Any) -> bool:
    assert isinstance(x, bool)
    return x


def from_int(x: Any) -> int:
    assert isinstance(x, int) and not isinstance(x, bool)
    return x


def from_dict(f: Callable[[Any], T], x: Any) -> Dict[str, T]:
    assert isinstance(x, dict)
    return { k: f(v) for (k, v) in x.items() }


def to_class(c: Type[T], x: Any) -> dict:
    assert isinstance(x, c)
    return cast(Any, x).to_dict()


class BrainHealth(Enum):
    GREEN = "green"
    RED = "red"
    UNKNOWN = "unknown"
    YELLOW = "yellow"


@dataclass
class AgenticTuringTest:
    brain_health: Optional[BrainHealth] = None
    challenge_endpoint: Optional[str] = None
    last_passed_at: Optional[datetime] = None

    @staticmethod
    def from_dict(obj: Any) -> 'AgenticTuringTest':
        assert isinstance(obj, dict)
        brain_health = from_union([BrainHealth, from_none], obj.get("brain_health"))
        challenge_endpoint = from_union([from_str, from_none], obj.get("challenge_endpoint"))
        last_passed_at = from_union([from_datetime, from_none], obj.get("last_passed_at"))
        return AgenticTuringTest(brain_health, challenge_endpoint, last_passed_at)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.brain_health is not None:
            result["brain_health"] = from_union([lambda x: to_enum(BrainHealth, x), from_none], self.brain_health)
        if self.challenge_endpoint is not None:
            result["challenge_endpoint"] = from_union([from_str, from_none], self.challenge_endpoint)
        if self.last_passed_at is not None:
            result["last_passed_at"] = from_union([lambda x: x.isoformat(), from_none], self.last_passed_at)
        return result


class ClassOrInstance(Enum):
    CLASS = "class"
    INSTANCE = "instance"


class PiiProcessing(Enum):
    NONE = "none"
    STORED = "stored"
    TRANSIENT = "transient"


@dataclass
class DataHandling:
    jurisdiction: Optional[str] = None
    log_retention: Optional[str] = None
    pii_processing: Optional[PiiProcessing] = None

    @staticmethod
    def from_dict(obj: Any) -> 'DataHandling':
        assert isinstance(obj, dict)
        jurisdiction = from_union([from_str, from_none], obj.get("jurisdiction"))
        log_retention = from_union([from_str, from_none], obj.get("log_retention"))
        pii_processing = from_union([PiiProcessing, from_none], obj.get("pii_processing"))
        return DataHandling(jurisdiction, log_retention, pii_processing)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.jurisdiction is not None:
            result["jurisdiction"] = from_union([from_str, from_none], self.jurisdiction)
        if self.log_retention is not None:
            result["log_retention"] = from_union([from_str, from_none], self.log_retention)
        if self.pii_processing is not None:
            result["pii_processing"] = from_union([lambda x: to_enum(PiiProcessing, x), from_none], self.pii_processing)
        return result


class VerificationMethod(Enum):
    EMAIL = "email"
    GITHUB_GIST = "github_gist"
    TWEET = "tweet"


@dataclass
class HumanOwner:
    display_name: Optional[str] = None
    handle: Optional[str] = None
    verification_method: Optional[VerificationMethod] = None
    verified_at: Optional[datetime] = None

    @staticmethod
    def from_dict(obj: Any) -> 'HumanOwner':
        assert isinstance(obj, dict)
        display_name = from_union([from_str, from_none], obj.get("display_name"))
        handle = from_union([from_str, from_none], obj.get("handle"))
        verification_method = from_union([VerificationMethod, from_none], obj.get("verification_method"))
        verified_at = from_union([from_datetime, from_none], obj.get("verified_at"))
        return HumanOwner(display_name, handle, verification_method, verified_at)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.display_name is not None:
            result["display_name"] = from_union([from_str, from_none], self.display_name)
        if self.handle is not None:
            result["handle"] = from_union([from_str, from_none], self.handle)
        if self.verification_method is not None:
            result["verification_method"] = from_union([lambda x: to_enum(VerificationMethod, x), from_none], self.verification_method)
        if self.verified_at is not None:
            result["verified_at"] = from_union([lambda x: x.isoformat(), from_none], self.verified_at)
        return result


class Status(Enum):
    LIVE = "live"
    OFFLINE = "offline"
    REVOKED = "revoked"
    STALE = "stale"


@dataclass
class Liveness:
    last_heartbeat: Optional[datetime] = None
    status: Optional[Status] = None
    uptime_30_d: Optional[float] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Liveness':
        assert isinstance(obj, dict)
        last_heartbeat = from_union([from_datetime, from_none], obj.get("last_heartbeat"))
        status = from_union([Status, from_none], obj.get("status"))
        uptime_30_d = from_union([from_float, from_none], obj.get("uptime_30d"))
        return Liveness(last_heartbeat, status, uptime_30_d)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.last_heartbeat is not None:
            result["last_heartbeat"] = from_union([lambda x: x.isoformat(), from_none], self.last_heartbeat)
        if self.status is not None:
            result["status"] = from_union([lambda x: to_enum(Status, x), from_none], self.status)
        if self.uptime_30_d is not None:
            result["uptime_30d"] = from_union([to_float, from_none], self.uptime_30_d)
        return result


class MandatesSupported(Enum):
    CART = "cart"
    INTENT = "intent"


class PaymentRailType(Enum):
    AP2 = "ap2"
    STRIPE_MPP = "stripe_mpp"
    X402 = "x402"


@dataclass
class PaymentRail:
    type: PaymentRailType
    asset: Optional[str] = None
    facilitator: Optional[str] = None
    mandates_supported: Optional[List[MandatesSupported]] = None
    pricing_hint: Optional[str] = None
    session_supported: Optional[bool] = None

    @staticmethod
    def from_dict(obj: Any) -> 'PaymentRail':
        assert isinstance(obj, dict)
        type = PaymentRailType(obj.get("type"))
        asset = from_union([from_str, from_none], obj.get("asset"))
        facilitator = from_union([from_str, from_none], obj.get("facilitator"))
        mandates_supported = from_union([lambda x: from_list(MandatesSupported, x), from_none], obj.get("mandates_supported"))
        pricing_hint = from_union([from_str, from_none], obj.get("pricing_hint"))
        session_supported = from_union([from_bool, from_none], obj.get("session_supported"))
        return PaymentRail(type, asset, facilitator, mandates_supported, pricing_hint, session_supported)

    def to_dict(self) -> dict:
        result: dict = {}
        result["type"] = to_enum(PaymentRailType, self.type)
        if self.asset is not None:
            result["asset"] = from_union([from_str, from_none], self.asset)
        if self.facilitator is not None:
            result["facilitator"] = from_union([from_str, from_none], self.facilitator)
        if self.mandates_supported is not None:
            result["mandates_supported"] = from_union([lambda x: from_list(lambda x: to_enum(MandatesSupported, x), x), from_none], self.mandates_supported)
        if self.pricing_hint is not None:
            result["pricing_hint"] = from_union([from_str, from_none], self.pricing_hint)
        if self.session_supported is not None:
            result["session_supported"] = from_union([from_bool, from_none], self.session_supported)
        return result


@dataclass
class Pricing:
    """Explicit pricing signal. Presence of this object (together with a payment_rails entry)
    satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
    """
    amount: Optional[str] = None
    """Decimal string, no float precision loss."""

    currency: Optional[str] = None
    unit: Optional[str] = None
    """e.g. per_1k_tokens, per_request, per_minute."""

    @staticmethod
    def from_dict(obj: Any) -> 'Pricing':
        assert isinstance(obj, dict)
        amount = from_union([from_str, from_none], obj.get("amount"))
        currency = from_union([from_str, from_none], obj.get("currency"))
        unit = from_union([from_str, from_none], obj.get("unit"))
        return Pricing(amount, currency, unit)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.amount is not None:
            result["amount"] = from_union([from_str, from_none], self.amount)
        if self.currency is not None:
            result["currency"] = from_union([from_str, from_none], self.currency)
        if self.unit is not None:
            result["unit"] = from_union([from_str, from_none], self.unit)
        return result


@dataclass
class ScoutRating:
    last_tested_at: Optional[datetime] = None
    pass_rate: Optional[float] = None
    test_suite_version: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'ScoutRating':
        assert isinstance(obj, dict)
        last_tested_at = from_union([from_datetime, from_none], obj.get("last_tested_at"))
        pass_rate = from_union([from_float, from_none], obj.get("pass_rate"))
        test_suite_version = from_union([from_str, from_none], obj.get("test_suite_version"))
        return ScoutRating(last_tested_at, pass_rate, test_suite_version)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.last_tested_at is not None:
            result["last_tested_at"] = from_union([lambda x: x.isoformat(), from_none], self.last_tested_at)
        if self.pass_rate is not None:
            result["pass_rate"] = from_union([to_float, from_none], self.pass_rate)
        if self.test_suite_version is not None:
            result["test_suite_version"] = from_union([from_str, from_none], self.test_suite_version)
        return result


@dataclass
class Signatures:
    ed25519_public_key_hex: str
    jws_signature: str
    recovery_key_fingerprint: Optional[str] = None
    transparency_log_entry: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Signatures':
        assert isinstance(obj, dict)
        ed25519_public_key_hex = from_str(obj.get("ed25519_public_key_hex"))
        jws_signature = from_str(obj.get("jws_signature"))
        recovery_key_fingerprint = from_union([from_str, from_none], obj.get("recovery_key_fingerprint"))
        transparency_log_entry = from_union([from_str, from_none], obj.get("transparency_log_entry"))
        return Signatures(ed25519_public_key_hex, jws_signature, recovery_key_fingerprint, transparency_log_entry)

    def to_dict(self) -> dict:
        result: dict = {}
        result["ed25519_public_key_hex"] = from_str(self.ed25519_public_key_hex)
        result["jws_signature"] = from_str(self.jws_signature)
        if self.recovery_key_fingerprint is not None:
            result["recovery_key_fingerprint"] = from_union([from_str, from_none], self.recovery_key_fingerprint)
        if self.transparency_log_entry is not None:
            result["transparency_log_entry"] = from_union([from_str, from_none], self.transparency_log_entry)
        return result


@dataclass
class SubAgentDependency:
    url: str
    invoked_when: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'SubAgentDependency':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        invoked_when = from_union([from_str, from_none], obj.get("invoked_when"))
        return SubAgentDependency(url, invoked_when)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.invoked_when is not None:
            result["invoked_when"] = from_union([from_str, from_none], self.invoked_when)
        return result


class Method(Enum):
    DNS_TXT_PLUS_ENDPOINT_CHALLENGE = "dns_txt_plus_endpoint_challenge"
    EMAIL = "email"
    GITHUB_GIST = "github_gist"
    GITHUB_ORG = "github_org"
    TWEET = "tweet"


class VerifiedAssetType(Enum):
    DOMAIN = "domain"
    GITHUB_HANDLE = "github_handle"
    X_HANDLE = "x_handle"


@dataclass
class VerifiedAsset:
    method: Method
    type: VerifiedAssetType
    value: str
    verified_at: datetime

    @staticmethod
    def from_dict(obj: Any) -> 'VerifiedAsset':
        assert isinstance(obj, dict)
        method = Method(obj.get("method"))
        type = VerifiedAssetType(obj.get("type"))
        value = from_str(obj.get("value"))
        verified_at = from_datetime(obj.get("verified_at"))
        return VerifiedAsset(method, type, value, verified_at)

    def to_dict(self) -> dict:
        result: dict = {}
        result["method"] = to_enum(Method, self.method)
        result["type"] = to_enum(VerifiedAssetType, self.type)
        result["value"] = from_str(self.value)
        result["verified_at"] = self.verified_at.isoformat()
        return result


@dataclass
class XFoxbook:
    """Foxbook-specific AgentCard extension fields, placed under the `x-foxbook` namespace
    inside an A2A AgentCard. Authoritative shape in docs/foundation/foxbook-foundation.md
    §6.2. Shared primitives (did, ed25519PublicKey, recoveryKeyFingerprint) are exposed via
    $defs so other schemas ($ref-in) don't duplicate their types.
    """
    class_or_instance: ClassOrInstance
    did: str
    foxbook_url: str
    """Canonical profile URL under foxbook.dev."""

    signatures: Signatures
    updated_at: datetime
    verification_tier: int
    """Tier 0–4 per foundation §6.5. Tier 5 (human-reviewed) is V3-only, not valid in V1."""

    version_hash: str
    agentic_turing_test: Optional[AgenticTuringTest] = None
    attestations: Optional[List[Dict[str, Any]]] = None
    data_handling: Optional[DataHandling] = None
    endorsements: Optional[List[Dict[str, Any]]] = None
    human_owner: Optional[HumanOwner] = None
    instance_uuid: Optional[str] = None
    liveness: Optional[Liveness] = None
    payment_rails: Optional[List[PaymentRail]] = None
    pricing: Optional[Pricing] = None
    """Explicit pricing signal. Presence of this object (together with a payment_rails entry)
    satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
    """
    reputation: Optional[Dict[str, Any]] = None
    """Denormalised reputation snapshot; rendered on profile pages. Computed server-side so the
    shape is flexible across versions — additional fields allowed within this sub-object only.
    """
    revoked: Optional[bool] = None
    revoked_reason: Optional[str] = None
    scout_rating: Optional[ScoutRating] = None
    sigstore_attestation: Optional[Dict[str, Any]] = None
    sub_agent_dependencies: Optional[List[SubAgentDependency]] = None
    verified_asset: Optional[VerifiedAsset] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbook':
        assert isinstance(obj, dict)
        class_or_instance = ClassOrInstance(obj.get("class_or_instance"))
        did = from_str(obj.get("did"))
        foxbook_url = from_str(obj.get("foxbook_url"))
        signatures = Signatures.from_dict(obj.get("signatures"))
        updated_at = from_datetime(obj.get("updated_at"))
        verification_tier = from_int(obj.get("verification_tier"))
        version_hash = from_str(obj.get("version_hash"))
        agentic_turing_test = from_union([AgenticTuringTest.from_dict, from_none], obj.get("agentic_turing_test"))
        attestations = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], obj.get("attestations"))
        data_handling = from_union([DataHandling.from_dict, from_none], obj.get("data_handling"))
        endorsements = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], obj.get("endorsements"))
        human_owner = from_union([HumanOwner.from_dict, from_none], obj.get("human_owner"))
        instance_uuid = from_union([from_none, from_str], obj.get("instance_uuid"))
        liveness = from_union([Liveness.from_dict, from_none], obj.get("liveness"))
        payment_rails = from_union([lambda x: from_list(PaymentRail.from_dict, x), from_none], obj.get("payment_rails"))
        pricing = from_union([Pricing.from_dict, from_none], obj.get("pricing"))
        reputation = from_union([lambda x: from_dict(lambda x: x, x), from_none], obj.get("reputation"))
        revoked = from_union([from_bool, from_none], obj.get("revoked"))
        revoked_reason = from_union([from_none, from_str], obj.get("revoked_reason"))
        scout_rating = from_union([ScoutRating.from_dict, from_none], obj.get("scout_rating"))
        sigstore_attestation = from_union([lambda x: from_dict(lambda x: x, x), from_none], obj.get("sigstore_attestation"))
        sub_agent_dependencies = from_union([lambda x: from_list(SubAgentDependency.from_dict, x), from_none], obj.get("sub_agent_dependencies"))
        verified_asset = from_union([VerifiedAsset.from_dict, from_none], obj.get("verified_asset"))
        return XFoxbook(class_or_instance, did, foxbook_url, signatures, updated_at, verification_tier, version_hash, agentic_turing_test, attestations, data_handling, endorsements, human_owner, instance_uuid, liveness, payment_rails, pricing, reputation, revoked, revoked_reason, scout_rating, sigstore_attestation, sub_agent_dependencies, verified_asset)

    def to_dict(self) -> dict:
        result: dict = {}
        result["class_or_instance"] = to_enum(ClassOrInstance, self.class_or_instance)
        result["did"] = from_str(self.did)
        result["foxbook_url"] = from_str(self.foxbook_url)
        result["signatures"] = to_class(Signatures, self.signatures)
        result["updated_at"] = self.updated_at.isoformat()
        result["verification_tier"] = from_int(self.verification_tier)
        result["version_hash"] = from_str(self.version_hash)
        if self.agentic_turing_test is not None:
            result["agentic_turing_test"] = from_union([lambda x: to_class(AgenticTuringTest, x), from_none], self.agentic_turing_test)
        if self.attestations is not None:
            result["attestations"] = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], self.attestations)
        if self.data_handling is not None:
            result["data_handling"] = from_union([lambda x: to_class(DataHandling, x), from_none], self.data_handling)
        if self.endorsements is not None:
            result["endorsements"] = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], self.endorsements)
        if self.human_owner is not None:
            result["human_owner"] = from_union([lambda x: to_class(HumanOwner, x), from_none], self.human_owner)
        if self.instance_uuid is not None:
            result["instance_uuid"] = from_union([from_none, from_str], self.instance_uuid)
        if self.liveness is not None:
            result["liveness"] = from_union([lambda x: to_class(Liveness, x), from_none], self.liveness)
        if self.payment_rails is not None:
            result["payment_rails"] = from_union([lambda x: from_list(lambda x: to_class(PaymentRail, x), x), from_none], self.payment_rails)
        if self.pricing is not None:
            result["pricing"] = from_union([lambda x: to_class(Pricing, x), from_none], self.pricing)
        if self.reputation is not None:
            result["reputation"] = from_union([lambda x: from_dict(lambda x: x, x), from_none], self.reputation)
        if self.revoked is not None:
            result["revoked"] = from_union([from_bool, from_none], self.revoked)
        if self.revoked_reason is not None:
            result["revoked_reason"] = from_union([from_none, from_str], self.revoked_reason)
        if self.scout_rating is not None:
            result["scout_rating"] = from_union([lambda x: to_class(ScoutRating, x), from_none], self.scout_rating)
        if self.sigstore_attestation is not None:
            result["sigstore_attestation"] = from_union([lambda x: from_dict(lambda x: x, x), from_none], self.sigstore_attestation)
        if self.sub_agent_dependencies is not None:
            result["sub_agent_dependencies"] = from_union([lambda x: from_list(lambda x: to_class(SubAgentDependency, x), x), from_none], self.sub_agent_dependencies)
        if self.verified_asset is not None:
            result["verified_asset"] = from_union([lambda x: to_class(VerifiedAsset, x), from_none], self.verified_asset)
        return result


def x_foxbook_from_dict(s: Any) -> XFoxbook:
    return XFoxbook.from_dict(s)


def x_foxbook_to_dict(x: XFoxbook) -> Any:
    return to_class(XFoxbook, x)

