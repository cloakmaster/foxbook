# AUTO-GENERATED — do not hand-edit.
# Source: schemas/agent-card.v1.json
# Regenerate via `pnpm generate:types`.
from enum import Enum
from dataclasses import dataclass
from typing import Any, List, Optional, Dict, TypeVar, Type, Callable, cast
from datetime import datetime
import dateutil.parser


T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)


def from_str(x: Any) -> str:
    assert isinstance(x, str)
    return x


def to_enum(c: Type[EnumT], x: Any) -> EnumT:
    assert isinstance(x, c)
    return x.value


def from_list(f: Callable[[Any], T], x: Any) -> List[T]:
    assert isinstance(x, list)
    return [f(y) for y in x]


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


def from_bool(x: Any) -> bool:
    assert isinstance(x, bool)
    return x


def from_datetime(x: Any) -> datetime:
    return dateutil.parser.parse(x)


def from_float(x: Any) -> float:
    assert isinstance(x, (float, int)) and not isinstance(x, bool)
    return float(x)


def to_float(x: Any) -> float:
    assert isinstance(x, (int, float))
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


class Transport(Enum):
    GRPC = "GRPC"
    HTTP_JSON = "HTTP+JSON"
    JSONRPC = "JSONRPC"


@dataclass
class AdditionalInterface:
    transport: Transport
    url: str

    @staticmethod
    def from_dict(obj: Any) -> 'AdditionalInterface':
        assert isinstance(obj, dict)
        transport = Transport(obj.get("transport"))
        url = from_str(obj.get("url"))
        return AdditionalInterface(transport, url)

    def to_dict(self) -> dict:
        result: dict = {}
        result["transport"] = to_enum(Transport, self.transport)
        result["url"] = from_str(self.url)
        return result


@dataclass
class Authentication:
    schemes: Optional[List[str]] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Authentication':
        assert isinstance(obj, dict)
        schemes = from_union([lambda x: from_list(from_str, x), from_none], obj.get("schemes"))
        return Authentication(schemes)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.schemes is not None:
            result["schemes"] = from_union([lambda x: from_list(from_str, x), from_none], self.schemes)
        return result


@dataclass
class Capabilities:
    push_notifications: Optional[bool] = None
    state_transition_history: Optional[bool] = None
    streaming: Optional[bool] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Capabilities':
        assert isinstance(obj, dict)
        push_notifications = from_union([from_bool, from_none], obj.get("pushNotifications"))
        state_transition_history = from_union([from_bool, from_none], obj.get("stateTransitionHistory"))
        streaming = from_union([from_bool, from_none], obj.get("streaming"))
        return Capabilities(push_notifications, state_transition_history, streaming)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.push_notifications is not None:
            result["pushNotifications"] = from_union([from_bool, from_none], self.push_notifications)
        if self.state_transition_history is not None:
            result["stateTransitionHistory"] = from_union([from_bool, from_none], self.state_transition_history)
        if self.streaming is not None:
            result["streaming"] = from_union([from_bool, from_none], self.streaming)
        return result


class ProtocolVersion(Enum):
    THE_030 = "0.3.0"


@dataclass
class Provider:
    organization: Optional[str] = None
    url: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Provider':
        assert isinstance(obj, dict)
        organization = from_union([from_str, from_none], obj.get("organization"))
        url = from_union([from_str, from_none], obj.get("url"))
        return Provider(organization, url)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.organization is not None:
            result["organization"] = from_union([from_str, from_none], self.organization)
        if self.url is not None:
            result["url"] = from_union([from_str, from_none], self.url)
        return result


@dataclass
class Skill:
    description: str
    id: str
    name: str
    tags: Optional[List[str]] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Skill':
        assert isinstance(obj, dict)
        description = from_str(obj.get("description"))
        id = from_str(obj.get("id"))
        name = from_str(obj.get("name"))
        tags = from_union([lambda x: from_list(from_str, x), from_none], obj.get("tags"))
        return Skill(description, id, name, tags)

    def to_dict(self) -> dict:
        result: dict = {}
        result["description"] = from_str(self.description)
        result["id"] = from_str(self.id)
        result["name"] = from_str(self.name)
        if self.tags is not None:
            result["tags"] = from_union([lambda x: from_list(from_str, x), from_none], self.tags)
        return result


class BrainHealth(Enum):
    GREEN = "green"
    RED = "red"
    UNKNOWN = "unknown"
    YELLOW = "yellow"


@dataclass
class XFoxbookAgenticTuringTest:
    brain_health: Optional[BrainHealth] = None
    challenge_endpoint: Optional[str] = None
    last_passed_at: Optional[datetime] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookAgenticTuringTest':
        assert isinstance(obj, dict)
        brain_health = from_union([BrainHealth, from_none], obj.get("brain_health"))
        challenge_endpoint = from_union([from_str, from_none], obj.get("challenge_endpoint"))
        last_passed_at = from_union([from_datetime, from_none], obj.get("last_passed_at"))
        return XFoxbookAgenticTuringTest(brain_health, challenge_endpoint, last_passed_at)

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
class XFoxbookDataHandling:
    jurisdiction: Optional[str] = None
    log_retention: Optional[str] = None
    pii_processing: Optional[PiiProcessing] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookDataHandling':
        assert isinstance(obj, dict)
        jurisdiction = from_union([from_str, from_none], obj.get("jurisdiction"))
        log_retention = from_union([from_str, from_none], obj.get("log_retention"))
        pii_processing = from_union([PiiProcessing, from_none], obj.get("pii_processing"))
        return XFoxbookDataHandling(jurisdiction, log_retention, pii_processing)

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
class XFoxbookHumanOwner:
    display_name: Optional[str] = None
    handle: Optional[str] = None
    verification_method: Optional[VerificationMethod] = None
    verified_at: Optional[datetime] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookHumanOwner':
        assert isinstance(obj, dict)
        display_name = from_union([from_str, from_none], obj.get("display_name"))
        handle = from_union([from_str, from_none], obj.get("handle"))
        verification_method = from_union([VerificationMethod, from_none], obj.get("verification_method"))
        verified_at = from_union([from_datetime, from_none], obj.get("verified_at"))
        return XFoxbookHumanOwner(display_name, handle, verification_method, verified_at)

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
class XFoxbookLiveness:
    last_heartbeat: Optional[datetime] = None
    status: Optional[Status] = None
    uptime_30_d: Optional[float] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookLiveness':
        assert isinstance(obj, dict)
        last_heartbeat = from_union([from_datetime, from_none], obj.get("last_heartbeat"))
        status = from_union([Status, from_none], obj.get("status"))
        uptime_30_d = from_union([from_float, from_none], obj.get("uptime_30d"))
        return XFoxbookLiveness(last_heartbeat, status, uptime_30_d)

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
class XFoxbookPaymentRail:
    type: PaymentRailType
    asset: Optional[str] = None
    facilitator: Optional[str] = None
    mandates_supported: Optional[List[MandatesSupported]] = None
    pricing_hint: Optional[str] = None
    session_supported: Optional[bool] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookPaymentRail':
        assert isinstance(obj, dict)
        type = PaymentRailType(obj.get("type"))
        asset = from_union([from_str, from_none], obj.get("asset"))
        facilitator = from_union([from_str, from_none], obj.get("facilitator"))
        mandates_supported = from_union([lambda x: from_list(MandatesSupported, x), from_none], obj.get("mandates_supported"))
        pricing_hint = from_union([from_str, from_none], obj.get("pricing_hint"))
        session_supported = from_union([from_bool, from_none], obj.get("session_supported"))
        return XFoxbookPaymentRail(type, asset, facilitator, mandates_supported, pricing_hint, session_supported)

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
class XFoxbookPricing:
    """Explicit pricing signal. Presence of this object (together with a payment_rails entry)
    satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
    """
    amount: Optional[str] = None
    """Decimal string, no float precision loss."""

    currency: Optional[str] = None
    unit: Optional[str] = None
    """e.g. per_1k_tokens, per_request, per_minute."""

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookPricing':
        assert isinstance(obj, dict)
        amount = from_union([from_str, from_none], obj.get("amount"))
        currency = from_union([from_str, from_none], obj.get("currency"))
        unit = from_union([from_str, from_none], obj.get("unit"))
        return XFoxbookPricing(amount, currency, unit)

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
class XFoxbookScoutRating:
    last_tested_at: Optional[datetime] = None
    pass_rate: Optional[float] = None
    test_suite_version: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookScoutRating':
        assert isinstance(obj, dict)
        last_tested_at = from_union([from_datetime, from_none], obj.get("last_tested_at"))
        pass_rate = from_union([from_float, from_none], obj.get("pass_rate"))
        test_suite_version = from_union([from_str, from_none], obj.get("test_suite_version"))
        return XFoxbookScoutRating(last_tested_at, pass_rate, test_suite_version)

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
class XFoxbookSignatures:
    ed25519_public_key_hex: str
    jws_signature: str
    recovery_key_fingerprint: Optional[str] = None
    transparency_log_entry: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookSignatures':
        assert isinstance(obj, dict)
        ed25519_public_key_hex = from_str(obj.get("ed25519_public_key_hex"))
        jws_signature = from_str(obj.get("jws_signature"))
        recovery_key_fingerprint = from_union([from_str, from_none], obj.get("recovery_key_fingerprint"))
        transparency_log_entry = from_union([from_str, from_none], obj.get("transparency_log_entry"))
        return XFoxbookSignatures(ed25519_public_key_hex, jws_signature, recovery_key_fingerprint, transparency_log_entry)

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
class XFoxbookSubAgentDependency:
    url: str
    invoked_when: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookSubAgentDependency':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        invoked_when = from_union([from_str, from_none], obj.get("invoked_when"))
        return XFoxbookSubAgentDependency(url, invoked_when)

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
class XFoxbookVerifiedAsset:
    method: Method
    type: VerifiedAssetType
    value: str
    verified_at: datetime

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookVerifiedAsset':
        assert isinstance(obj, dict)
        method = Method(obj.get("method"))
        type = VerifiedAssetType(obj.get("type"))
        value = from_str(obj.get("value"))
        verified_at = from_datetime(obj.get("verified_at"))
        return XFoxbookVerifiedAsset(method, type, value, verified_at)

    def to_dict(self) -> dict:
        result: dict = {}
        result["method"] = to_enum(Method, self.method)
        result["type"] = to_enum(VerifiedAssetType, self.type)
        result["value"] = from_str(self.value)
        result["verified_at"] = self.verified_at.isoformat()
        return result


@dataclass
class XFoxbookClass:
    """Foxbook-specific AgentCard extension fields, placed under the `x-foxbook` namespace
    inside an A2A AgentCard. Authoritative shape in docs/foundation/foxbook-foundation.md
    §6.2. Shared primitives (did, ed25519PublicKey, recoveryKeyFingerprint) are exposed via
    $defs so other schemas ($ref-in) don't duplicate their types.
    """
    class_or_instance: ClassOrInstance
    did: str
    foxbook_url: str
    """Canonical profile URL under foxbook.dev."""

    signatures: XFoxbookSignatures
    updated_at: datetime
    verification_tier: int
    """Tier 0–4 per foundation §6.5. Tier 5 (human-reviewed) is V3-only, not valid in V1."""

    version_hash: str
    agentic_turing_test: Optional[XFoxbookAgenticTuringTest] = None
    attestations: Optional[List[Dict[str, Any]]] = None
    data_handling: Optional[XFoxbookDataHandling] = None
    endorsements: Optional[List[Dict[str, Any]]] = None
    human_owner: Optional[XFoxbookHumanOwner] = None
    instance_uuid: Optional[str] = None
    liveness: Optional[XFoxbookLiveness] = None
    payment_rails: Optional[List[XFoxbookPaymentRail]] = None
    pricing: Optional[XFoxbookPricing] = None
    """Explicit pricing signal. Presence of this object (together with a payment_rails entry)
    satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
    """
    reputation: Optional[Dict[str, Any]] = None
    """Denormalised reputation snapshot; rendered on profile pages. Computed server-side so the
    shape is flexible across versions — additional fields allowed within this sub-object only.
    """
    revoked: Optional[bool] = None
    revoked_reason: Optional[str] = None
    scout_rating: Optional[XFoxbookScoutRating] = None
    sigstore_attestation: Optional[Dict[str, Any]] = None
    sub_agent_dependencies: Optional[List[XFoxbookSubAgentDependency]] = None
    verified_asset: Optional[XFoxbookVerifiedAsset] = None

    @staticmethod
    def from_dict(obj: Any) -> 'XFoxbookClass':
        assert isinstance(obj, dict)
        class_or_instance = ClassOrInstance(obj.get("class_or_instance"))
        did = from_str(obj.get("did"))
        foxbook_url = from_str(obj.get("foxbook_url"))
        signatures = XFoxbookSignatures.from_dict(obj.get("signatures"))
        updated_at = from_datetime(obj.get("updated_at"))
        verification_tier = from_int(obj.get("verification_tier"))
        version_hash = from_str(obj.get("version_hash"))
        agentic_turing_test = from_union([XFoxbookAgenticTuringTest.from_dict, from_none], obj.get("agentic_turing_test"))
        attestations = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], obj.get("attestations"))
        data_handling = from_union([XFoxbookDataHandling.from_dict, from_none], obj.get("data_handling"))
        endorsements = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], obj.get("endorsements"))
        human_owner = from_union([XFoxbookHumanOwner.from_dict, from_none], obj.get("human_owner"))
        instance_uuid = from_union([from_none, from_str], obj.get("instance_uuid"))
        liveness = from_union([XFoxbookLiveness.from_dict, from_none], obj.get("liveness"))
        payment_rails = from_union([lambda x: from_list(XFoxbookPaymentRail.from_dict, x), from_none], obj.get("payment_rails"))
        pricing = from_union([XFoxbookPricing.from_dict, from_none], obj.get("pricing"))
        reputation = from_union([lambda x: from_dict(lambda x: x, x), from_none], obj.get("reputation"))
        revoked = from_union([from_bool, from_none], obj.get("revoked"))
        revoked_reason = from_union([from_none, from_str], obj.get("revoked_reason"))
        scout_rating = from_union([XFoxbookScoutRating.from_dict, from_none], obj.get("scout_rating"))
        sigstore_attestation = from_union([lambda x: from_dict(lambda x: x, x), from_none], obj.get("sigstore_attestation"))
        sub_agent_dependencies = from_union([lambda x: from_list(XFoxbookSubAgentDependency.from_dict, x), from_none], obj.get("sub_agent_dependencies"))
        verified_asset = from_union([XFoxbookVerifiedAsset.from_dict, from_none], obj.get("verified_asset"))
        return XFoxbookClass(class_or_instance, did, foxbook_url, signatures, updated_at, verification_tier, version_hash, agentic_turing_test, attestations, data_handling, endorsements, human_owner, instance_uuid, liveness, payment_rails, pricing, reputation, revoked, revoked_reason, scout_rating, sigstore_attestation, sub_agent_dependencies, verified_asset)

    def to_dict(self) -> dict:
        result: dict = {}
        result["class_or_instance"] = to_enum(ClassOrInstance, self.class_or_instance)
        result["did"] = from_str(self.did)
        result["foxbook_url"] = from_str(self.foxbook_url)
        result["signatures"] = to_class(XFoxbookSignatures, self.signatures)
        result["updated_at"] = self.updated_at.isoformat()
        result["verification_tier"] = from_int(self.verification_tier)
        result["version_hash"] = from_str(self.version_hash)
        if self.agentic_turing_test is not None:
            result["agentic_turing_test"] = from_union([lambda x: to_class(XFoxbookAgenticTuringTest, x), from_none], self.agentic_turing_test)
        if self.attestations is not None:
            result["attestations"] = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], self.attestations)
        if self.data_handling is not None:
            result["data_handling"] = from_union([lambda x: to_class(XFoxbookDataHandling, x), from_none], self.data_handling)
        if self.endorsements is not None:
            result["endorsements"] = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], self.endorsements)
        if self.human_owner is not None:
            result["human_owner"] = from_union([lambda x: to_class(XFoxbookHumanOwner, x), from_none], self.human_owner)
        if self.instance_uuid is not None:
            result["instance_uuid"] = from_union([from_none, from_str], self.instance_uuid)
        if self.liveness is not None:
            result["liveness"] = from_union([lambda x: to_class(XFoxbookLiveness, x), from_none], self.liveness)
        if self.payment_rails is not None:
            result["payment_rails"] = from_union([lambda x: from_list(lambda x: to_class(XFoxbookPaymentRail, x), x), from_none], self.payment_rails)
        if self.pricing is not None:
            result["pricing"] = from_union([lambda x: to_class(XFoxbookPricing, x), from_none], self.pricing)
        if self.reputation is not None:
            result["reputation"] = from_union([lambda x: from_dict(lambda x: x, x), from_none], self.reputation)
        if self.revoked is not None:
            result["revoked"] = from_union([from_bool, from_none], self.revoked)
        if self.revoked_reason is not None:
            result["revoked_reason"] = from_union([from_none, from_str], self.revoked_reason)
        if self.scout_rating is not None:
            result["scout_rating"] = from_union([lambda x: to_class(XFoxbookScoutRating, x), from_none], self.scout_rating)
        if self.sigstore_attestation is not None:
            result["sigstore_attestation"] = from_union([lambda x: from_dict(lambda x: x, x), from_none], self.sigstore_attestation)
        if self.sub_agent_dependencies is not None:
            result["sub_agent_dependencies"] = from_union([lambda x: from_list(lambda x: to_class(XFoxbookSubAgentDependency, x), x), from_none], self.sub_agent_dependencies)
        if self.verified_asset is not None:
            result["verified_asset"] = from_union([lambda x: to_class(XFoxbookVerifiedAsset, x), from_none], self.verified_asset)
        return result


@dataclass
class A2AAgentCardFoxbookMirroredV1:
    """Google A2A AgentCard pinned to upstream v0.3.0 (protocolVersion == "0.3.0", source:
    github.com/a2aproject/a2a-js @ v0.3.0, validated against @a2a-js/sdk AgentCard type
    2026-04-22). Foxbook mirrors the shape used in practice by the published A2A SDKs rather
    than attempting to replicate the full RFC; extensions land under `x-foxbook` ($ref
    x-foxbook.v1.json) to stay A2A-forward-compatible. NOTE: top-level `additionalProperties`
    is intentionally omitted (not set to true, not set to false) so unknown A2A v0.3.x
    optional fields (e.g. additionalInterfaces, supportsAuthenticatedExtendedCard) pass
    through without breaking the validator — this is the single controlled deviation from the
    `no additionalProperties: true on top-level` rule and is required for A2A forward-compat.
    """
    capabilities: Capabilities
    default_input_modes: List[str]
    default_output_modes: List[str]
    description: str
    name: str
    protocol_version: ProtocolVersion
    """A2A spec version. We pin v0.3.0 in v1; a future v0.4.x would land behind an
    `agent-card.v2.json` schema file, not an in-place edit.
    """
    skills: List[Skill]
    url: str
    version: str
    additional_interfaces: Optional[List[AdditionalInterface]] = None
    authentication: Optional[Authentication] = None
    provider: Optional[Provider] = None
    x_foxbook: Optional[XFoxbookClass] = None

    @staticmethod
    def from_dict(obj: Any) -> 'A2AAgentCardFoxbookMirroredV1':
        assert isinstance(obj, dict)
        capabilities = Capabilities.from_dict(obj.get("capabilities"))
        default_input_modes = from_list(from_str, obj.get("defaultInputModes"))
        default_output_modes = from_list(from_str, obj.get("defaultOutputModes"))
        description = from_str(obj.get("description"))
        name = from_str(obj.get("name"))
        protocol_version = ProtocolVersion(obj.get("protocolVersion"))
        skills = from_list(Skill.from_dict, obj.get("skills"))
        url = from_str(obj.get("url"))
        version = from_str(obj.get("version"))
        additional_interfaces = from_union([lambda x: from_list(AdditionalInterface.from_dict, x), from_none], obj.get("additionalInterfaces"))
        authentication = from_union([Authentication.from_dict, from_none], obj.get("authentication"))
        provider = from_union([Provider.from_dict, from_none], obj.get("provider"))
        x_foxbook = from_union([XFoxbookClass.from_dict, from_none], obj.get("x-foxbook"))
        return A2AAgentCardFoxbookMirroredV1(capabilities, default_input_modes, default_output_modes, description, name, protocol_version, skills, url, version, additional_interfaces, authentication, provider, x_foxbook)

    def to_dict(self) -> dict:
        result: dict = {}
        result["capabilities"] = to_class(Capabilities, self.capabilities)
        result["defaultInputModes"] = from_list(from_str, self.default_input_modes)
        result["defaultOutputModes"] = from_list(from_str, self.default_output_modes)
        result["description"] = from_str(self.description)
        result["name"] = from_str(self.name)
        result["protocolVersion"] = to_enum(ProtocolVersion, self.protocol_version)
        result["skills"] = from_list(lambda x: to_class(Skill, x), self.skills)
        result["url"] = from_str(self.url)
        result["version"] = from_str(self.version)
        if self.additional_interfaces is not None:
            result["additionalInterfaces"] = from_union([lambda x: from_list(lambda x: to_class(AdditionalInterface, x), x), from_none], self.additional_interfaces)
        if self.authentication is not None:
            result["authentication"] = from_union([lambda x: to_class(Authentication, x), from_none], self.authentication)
        if self.provider is not None:
            result["provider"] = from_union([lambda x: to_class(Provider, x), from_none], self.provider)
        if self.x_foxbook is not None:
            result["x-foxbook"] = from_union([lambda x: to_class(XFoxbookClass, x), from_none], self.x_foxbook)
        return result


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1AgenticTuringTest:
    brain_health: Optional[BrainHealth] = None
    challenge_endpoint: Optional[str] = None
    last_passed_at: Optional[datetime] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1AgenticTuringTest':
        assert isinstance(obj, dict)
        brain_health = from_union([BrainHealth, from_none], obj.get("brain_health"))
        challenge_endpoint = from_union([from_str, from_none], obj.get("challenge_endpoint"))
        last_passed_at = from_union([from_datetime, from_none], obj.get("last_passed_at"))
        return FoxbookAgentCardExtensionXFoxbookV1AgenticTuringTest(brain_health, challenge_endpoint, last_passed_at)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.brain_health is not None:
            result["brain_health"] = from_union([lambda x: to_enum(BrainHealth, x), from_none], self.brain_health)
        if self.challenge_endpoint is not None:
            result["challenge_endpoint"] = from_union([from_str, from_none], self.challenge_endpoint)
        if self.last_passed_at is not None:
            result["last_passed_at"] = from_union([lambda x: x.isoformat(), from_none], self.last_passed_at)
        return result


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1DataHandling:
    jurisdiction: Optional[str] = None
    log_retention: Optional[str] = None
    pii_processing: Optional[PiiProcessing] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1DataHandling':
        assert isinstance(obj, dict)
        jurisdiction = from_union([from_str, from_none], obj.get("jurisdiction"))
        log_retention = from_union([from_str, from_none], obj.get("log_retention"))
        pii_processing = from_union([PiiProcessing, from_none], obj.get("pii_processing"))
        return FoxbookAgentCardExtensionXFoxbookV1DataHandling(jurisdiction, log_retention, pii_processing)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.jurisdiction is not None:
            result["jurisdiction"] = from_union([from_str, from_none], self.jurisdiction)
        if self.log_retention is not None:
            result["log_retention"] = from_union([from_str, from_none], self.log_retention)
        if self.pii_processing is not None:
            result["pii_processing"] = from_union([lambda x: to_enum(PiiProcessing, x), from_none], self.pii_processing)
        return result


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1HumanOwner:
    display_name: Optional[str] = None
    handle: Optional[str] = None
    verification_method: Optional[VerificationMethod] = None
    verified_at: Optional[datetime] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1HumanOwner':
        assert isinstance(obj, dict)
        display_name = from_union([from_str, from_none], obj.get("display_name"))
        handle = from_union([from_str, from_none], obj.get("handle"))
        verification_method = from_union([VerificationMethod, from_none], obj.get("verification_method"))
        verified_at = from_union([from_datetime, from_none], obj.get("verified_at"))
        return FoxbookAgentCardExtensionXFoxbookV1HumanOwner(display_name, handle, verification_method, verified_at)

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


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1Liveness:
    last_heartbeat: Optional[datetime] = None
    status: Optional[Status] = None
    uptime_30_d: Optional[float] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1Liveness':
        assert isinstance(obj, dict)
        last_heartbeat = from_union([from_datetime, from_none], obj.get("last_heartbeat"))
        status = from_union([Status, from_none], obj.get("status"))
        uptime_30_d = from_union([from_float, from_none], obj.get("uptime_30d"))
        return FoxbookAgentCardExtensionXFoxbookV1Liveness(last_heartbeat, status, uptime_30_d)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.last_heartbeat is not None:
            result["last_heartbeat"] = from_union([lambda x: x.isoformat(), from_none], self.last_heartbeat)
        if self.status is not None:
            result["status"] = from_union([lambda x: to_enum(Status, x), from_none], self.status)
        if self.uptime_30_d is not None:
            result["uptime_30d"] = from_union([to_float, from_none], self.uptime_30_d)
        return result


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1PaymentRail:
    type: PaymentRailType
    asset: Optional[str] = None
    facilitator: Optional[str] = None
    mandates_supported: Optional[List[MandatesSupported]] = None
    pricing_hint: Optional[str] = None
    session_supported: Optional[bool] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1PaymentRail':
        assert isinstance(obj, dict)
        type = PaymentRailType(obj.get("type"))
        asset = from_union([from_str, from_none], obj.get("asset"))
        facilitator = from_union([from_str, from_none], obj.get("facilitator"))
        mandates_supported = from_union([lambda x: from_list(MandatesSupported, x), from_none], obj.get("mandates_supported"))
        pricing_hint = from_union([from_str, from_none], obj.get("pricing_hint"))
        session_supported = from_union([from_bool, from_none], obj.get("session_supported"))
        return FoxbookAgentCardExtensionXFoxbookV1PaymentRail(type, asset, facilitator, mandates_supported, pricing_hint, session_supported)

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
class FoxbookAgentCardExtensionXFoxbookV1Pricing:
    """Explicit pricing signal. Presence of this object (together with a payment_rails entry)
    satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
    """
    amount: Optional[str] = None
    """Decimal string, no float precision loss."""

    currency: Optional[str] = None
    unit: Optional[str] = None
    """e.g. per_1k_tokens, per_request, per_minute."""

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1Pricing':
        assert isinstance(obj, dict)
        amount = from_union([from_str, from_none], obj.get("amount"))
        currency = from_union([from_str, from_none], obj.get("currency"))
        unit = from_union([from_str, from_none], obj.get("unit"))
        return FoxbookAgentCardExtensionXFoxbookV1Pricing(amount, currency, unit)

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
class FoxbookAgentCardExtensionXFoxbookV1ScoutRating:
    last_tested_at: Optional[datetime] = None
    pass_rate: Optional[float] = None
    test_suite_version: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1ScoutRating':
        assert isinstance(obj, dict)
        last_tested_at = from_union([from_datetime, from_none], obj.get("last_tested_at"))
        pass_rate = from_union([from_float, from_none], obj.get("pass_rate"))
        test_suite_version = from_union([from_str, from_none], obj.get("test_suite_version"))
        return FoxbookAgentCardExtensionXFoxbookV1ScoutRating(last_tested_at, pass_rate, test_suite_version)

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
class FoxbookAgentCardExtensionXFoxbookV1Signatures:
    ed25519_public_key_hex: str
    jws_signature: str
    recovery_key_fingerprint: Optional[str] = None
    transparency_log_entry: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1Signatures':
        assert isinstance(obj, dict)
        ed25519_public_key_hex = from_str(obj.get("ed25519_public_key_hex"))
        jws_signature = from_str(obj.get("jws_signature"))
        recovery_key_fingerprint = from_union([from_str, from_none], obj.get("recovery_key_fingerprint"))
        transparency_log_entry = from_union([from_str, from_none], obj.get("transparency_log_entry"))
        return FoxbookAgentCardExtensionXFoxbookV1Signatures(ed25519_public_key_hex, jws_signature, recovery_key_fingerprint, transparency_log_entry)

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
class FoxbookAgentCardExtensionXFoxbookV1SubAgentDependency:
    url: str
    invoked_when: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1SubAgentDependency':
        assert isinstance(obj, dict)
        url = from_str(obj.get("url"))
        invoked_when = from_union([from_str, from_none], obj.get("invoked_when"))
        return FoxbookAgentCardExtensionXFoxbookV1SubAgentDependency(url, invoked_when)

    def to_dict(self) -> dict:
        result: dict = {}
        result["url"] = from_str(self.url)
        if self.invoked_when is not None:
            result["invoked_when"] = from_union([from_str, from_none], self.invoked_when)
        return result


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1VerifiedAsset:
    method: Method
    type: VerifiedAssetType
    value: str
    verified_at: datetime

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1VerifiedAsset':
        assert isinstance(obj, dict)
        method = Method(obj.get("method"))
        type = VerifiedAssetType(obj.get("type"))
        value = from_str(obj.get("value"))
        verified_at = from_datetime(obj.get("verified_at"))
        return FoxbookAgentCardExtensionXFoxbookV1VerifiedAsset(method, type, value, verified_at)

    def to_dict(self) -> dict:
        result: dict = {}
        result["method"] = to_enum(Method, self.method)
        result["type"] = to_enum(VerifiedAssetType, self.type)
        result["value"] = from_str(self.value)
        result["verified_at"] = self.verified_at.isoformat()
        return result


@dataclass
class FoxbookAgentCardExtensionXFoxbookV1:
    """Foxbook-specific AgentCard extension fields, placed under the `x-foxbook` namespace
    inside an A2A AgentCard. Authoritative shape in docs/foundation/foxbook-foundation.md
    §6.2. Shared primitives (did, ed25519PublicKey, recoveryKeyFingerprint) are exposed via
    $defs so other schemas ($ref-in) don't duplicate their types.
    """
    class_or_instance: ClassOrInstance
    did: str
    foxbook_url: str
    """Canonical profile URL under foxbook.dev."""

    signatures: FoxbookAgentCardExtensionXFoxbookV1Signatures
    updated_at: datetime
    verification_tier: int
    """Tier 0–4 per foundation §6.5. Tier 5 (human-reviewed) is V3-only, not valid in V1."""

    version_hash: str
    agentic_turing_test: Optional[FoxbookAgentCardExtensionXFoxbookV1AgenticTuringTest] = None
    attestations: Optional[List[Dict[str, Any]]] = None
    data_handling: Optional[FoxbookAgentCardExtensionXFoxbookV1DataHandling] = None
    endorsements: Optional[List[Dict[str, Any]]] = None
    human_owner: Optional[FoxbookAgentCardExtensionXFoxbookV1HumanOwner] = None
    instance_uuid: Optional[str] = None
    liveness: Optional[FoxbookAgentCardExtensionXFoxbookV1Liveness] = None
    payment_rails: Optional[List[FoxbookAgentCardExtensionXFoxbookV1PaymentRail]] = None
    pricing: Optional[FoxbookAgentCardExtensionXFoxbookV1Pricing] = None
    """Explicit pricing signal. Presence of this object (together with a payment_rails entry)
    satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
    """
    reputation: Optional[Dict[str, Any]] = None
    """Denormalised reputation snapshot; rendered on profile pages. Computed server-side so the
    shape is flexible across versions — additional fields allowed within this sub-object only.
    """
    revoked: Optional[bool] = None
    revoked_reason: Optional[str] = None
    scout_rating: Optional[FoxbookAgentCardExtensionXFoxbookV1ScoutRating] = None
    sigstore_attestation: Optional[Dict[str, Any]] = None
    sub_agent_dependencies: Optional[List[FoxbookAgentCardExtensionXFoxbookV1SubAgentDependency]] = None
    verified_asset: Optional[FoxbookAgentCardExtensionXFoxbookV1VerifiedAsset] = None

    @staticmethod
    def from_dict(obj: Any) -> 'FoxbookAgentCardExtensionXFoxbookV1':
        assert isinstance(obj, dict)
        class_or_instance = ClassOrInstance(obj.get("class_or_instance"))
        did = from_str(obj.get("did"))
        foxbook_url = from_str(obj.get("foxbook_url"))
        signatures = FoxbookAgentCardExtensionXFoxbookV1Signatures.from_dict(obj.get("signatures"))
        updated_at = from_datetime(obj.get("updated_at"))
        verification_tier = from_int(obj.get("verification_tier"))
        version_hash = from_str(obj.get("version_hash"))
        agentic_turing_test = from_union([FoxbookAgentCardExtensionXFoxbookV1AgenticTuringTest.from_dict, from_none], obj.get("agentic_turing_test"))
        attestations = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], obj.get("attestations"))
        data_handling = from_union([FoxbookAgentCardExtensionXFoxbookV1DataHandling.from_dict, from_none], obj.get("data_handling"))
        endorsements = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], obj.get("endorsements"))
        human_owner = from_union([FoxbookAgentCardExtensionXFoxbookV1HumanOwner.from_dict, from_none], obj.get("human_owner"))
        instance_uuid = from_union([from_none, from_str], obj.get("instance_uuid"))
        liveness = from_union([FoxbookAgentCardExtensionXFoxbookV1Liveness.from_dict, from_none], obj.get("liveness"))
        payment_rails = from_union([lambda x: from_list(FoxbookAgentCardExtensionXFoxbookV1PaymentRail.from_dict, x), from_none], obj.get("payment_rails"))
        pricing = from_union([FoxbookAgentCardExtensionXFoxbookV1Pricing.from_dict, from_none], obj.get("pricing"))
        reputation = from_union([lambda x: from_dict(lambda x: x, x), from_none], obj.get("reputation"))
        revoked = from_union([from_bool, from_none], obj.get("revoked"))
        revoked_reason = from_union([from_none, from_str], obj.get("revoked_reason"))
        scout_rating = from_union([FoxbookAgentCardExtensionXFoxbookV1ScoutRating.from_dict, from_none], obj.get("scout_rating"))
        sigstore_attestation = from_union([lambda x: from_dict(lambda x: x, x), from_none], obj.get("sigstore_attestation"))
        sub_agent_dependencies = from_union([lambda x: from_list(FoxbookAgentCardExtensionXFoxbookV1SubAgentDependency.from_dict, x), from_none], obj.get("sub_agent_dependencies"))
        verified_asset = from_union([FoxbookAgentCardExtensionXFoxbookV1VerifiedAsset.from_dict, from_none], obj.get("verified_asset"))
        return FoxbookAgentCardExtensionXFoxbookV1(class_or_instance, did, foxbook_url, signatures, updated_at, verification_tier, version_hash, agentic_turing_test, attestations, data_handling, endorsements, human_owner, instance_uuid, liveness, payment_rails, pricing, reputation, revoked, revoked_reason, scout_rating, sigstore_attestation, sub_agent_dependencies, verified_asset)

    def to_dict(self) -> dict:
        result: dict = {}
        result["class_or_instance"] = to_enum(ClassOrInstance, self.class_or_instance)
        result["did"] = from_str(self.did)
        result["foxbook_url"] = from_str(self.foxbook_url)
        result["signatures"] = to_class(FoxbookAgentCardExtensionXFoxbookV1Signatures, self.signatures)
        result["updated_at"] = self.updated_at.isoformat()
        result["verification_tier"] = from_int(self.verification_tier)
        result["version_hash"] = from_str(self.version_hash)
        if self.agentic_turing_test is not None:
            result["agentic_turing_test"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1AgenticTuringTest, x), from_none], self.agentic_turing_test)
        if self.attestations is not None:
            result["attestations"] = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], self.attestations)
        if self.data_handling is not None:
            result["data_handling"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1DataHandling, x), from_none], self.data_handling)
        if self.endorsements is not None:
            result["endorsements"] = from_union([lambda x: from_list(lambda x: from_dict(lambda x: x, x), x), from_none], self.endorsements)
        if self.human_owner is not None:
            result["human_owner"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1HumanOwner, x), from_none], self.human_owner)
        if self.instance_uuid is not None:
            result["instance_uuid"] = from_union([from_none, from_str], self.instance_uuid)
        if self.liveness is not None:
            result["liveness"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1Liveness, x), from_none], self.liveness)
        if self.payment_rails is not None:
            result["payment_rails"] = from_union([lambda x: from_list(lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1PaymentRail, x), x), from_none], self.payment_rails)
        if self.pricing is not None:
            result["pricing"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1Pricing, x), from_none], self.pricing)
        if self.reputation is not None:
            result["reputation"] = from_union([lambda x: from_dict(lambda x: x, x), from_none], self.reputation)
        if self.revoked is not None:
            result["revoked"] = from_union([from_bool, from_none], self.revoked)
        if self.revoked_reason is not None:
            result["revoked_reason"] = from_union([from_none, from_str], self.revoked_reason)
        if self.scout_rating is not None:
            result["scout_rating"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1ScoutRating, x), from_none], self.scout_rating)
        if self.sigstore_attestation is not None:
            result["sigstore_attestation"] = from_union([lambda x: from_dict(lambda x: x, x), from_none], self.sigstore_attestation)
        if self.sub_agent_dependencies is not None:
            result["sub_agent_dependencies"] = from_union([lambda x: from_list(lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1SubAgentDependency, x), x), from_none], self.sub_agent_dependencies)
        if self.verified_asset is not None:
            result["verified_asset"] = from_union([lambda x: to_class(FoxbookAgentCardExtensionXFoxbookV1VerifiedAsset, x), from_none], self.verified_asset)
        return result


def a2_a_agent_card_foxbook_mirrored_v1_from_dict(s: Any) -> A2AAgentCardFoxbookMirroredV1:
    return A2AAgentCardFoxbookMirroredV1.from_dict(s)


def a2_a_agent_card_foxbook_mirrored_v1_to_dict(x: A2AAgentCardFoxbookMirroredV1) -> Any:
    return to_class(A2AAgentCardFoxbookMirroredV1, x)


def foxbook_agent_card_extension_x_foxbook_v1_from_dict(s: Any) -> FoxbookAgentCardExtensionXFoxbookV1:
    return FoxbookAgentCardExtensionXFoxbookV1.from_dict(s)


def foxbook_agent_card_extension_x_foxbook_v1_to_dict(x: FoxbookAgentCardExtensionXFoxbookV1) -> Any:
    return to_class(FoxbookAgentCardExtensionXFoxbookV1, x)

