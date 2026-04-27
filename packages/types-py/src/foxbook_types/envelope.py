# AUTO-GENERATED — do not hand-edit.
# Source: schemas/envelope/v1.json
# Regenerate via `pnpm generate:types`.
from dataclasses import dataclass
from typing import List, Optional, Any, TypeVar, Callable, Type, cast
from enum import Enum
from datetime import datetime
import dateutil.parser


T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)


def from_list(f: Callable[[Any], T], x: Any) -> List[T]:
    assert isinstance(x, list)
    return [f(y) for y in x]


def from_str(x: Any) -> str:
    assert isinstance(x, str)
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


def from_int(x: Any) -> int:
    assert isinstance(x, int) and not isinstance(x, bool)
    return x


def to_enum(c: Type[EnumT], x: Any) -> EnumT:
    assert isinstance(x, c)
    return x.value


def from_float(x: Any) -> float:
    assert isinstance(x, (float, int)) and not isinstance(x, bool)
    return float(x)


def to_float(x: Any) -> float:
    assert isinstance(x, (int, float))
    return x


def from_datetime(x: Any) -> datetime:
    return dateutil.parser.parse(x)


def to_class(c: Type[T], x: Any) -> dict:
    assert isinstance(x, c)
    return cast(Any, x).to_dict()


@dataclass
class DelegationContext:
    declared_sub_agent_deps: Optional[List[str]] = None
    parent_event_id: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'DelegationContext':
        assert isinstance(obj, dict)
        declared_sub_agent_deps = from_union([lambda x: from_list(from_str, x), from_none], obj.get("declared_sub_agent_deps"))
        parent_event_id = from_union([from_none, from_str], obj.get("parent_event_id"))
        return DelegationContext(declared_sub_agent_deps, parent_event_id)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.declared_sub_agent_deps is not None:
            result["declared_sub_agent_deps"] = from_union([lambda x: from_list(from_str, x), from_none], self.declared_sub_agent_deps)
        if self.parent_event_id is not None:
            result["parent_event_id"] = from_union([from_none, from_str], self.parent_event_id)
        return result


class EnvelopeVersion(Enum):
    THE_10_DRAFT = "1.0-draft"


class EventType(Enum):
    """Day-7 PR D additively introduces claim.verified + revocation.recorded for the first wired
    firehose events. The hire.* + delegation.announced shapes (hirer/hiree/task/payment/...)
    remain the strict envelope for hire events. Per-event-type required-field gating across
    the new event types lands as a pre-freeze refinement (PROJECT-PLAN Day 7-9). Today the
    firehose wire payload for claim.verified / revocation.recorded carries {event_type, did,
    leaf_index, leaf_hash, timestamp, ...} inside the firehose_events.payload jsonb column
    without strict required-field validation; that's a deliberate scope cut so PR D is a
    minimal additive bump.
    """
    CLAIM_VERIFIED = "claim.verified"
    DELEGATION_ANNOUNCED = "delegation.announced"
    HIRE_FAILED = "hire.failed"
    HIRE_SETTLED = "hire.settled"
    REVOCATION_RECORDED = "revocation.recorded"


@dataclass
class Hiree:
    did: str
    url: str
    verification_tier: int
    version_hash: str

    @staticmethod
    def from_dict(obj: Any) -> 'Hiree':
        assert isinstance(obj, dict)
        did = from_str(obj.get("did"))
        url = from_str(obj.get("url"))
        verification_tier = from_int(obj.get("verification_tier"))
        version_hash = from_str(obj.get("version_hash"))
        return Hiree(did, url, verification_tier, version_hash)

    def to_dict(self) -> dict:
        result: dict = {}
        result["did"] = from_str(self.did)
        result["url"] = from_str(self.url)
        result["verification_tier"] = from_int(self.verification_tier)
        result["version_hash"] = from_str(self.version_hash)
        return result


class Rail(Enum):
    AP2 = "ap2"
    MPP = "mpp"
    X402 = "x402"


@dataclass
class Payment:
    amount: str
    """Decimal string to avoid float precision issues."""

    currency: str
    rail: Rail
    chain: Optional[str] = None
    receipt_url: Optional[str] = None
    tx_hash: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Payment':
        assert isinstance(obj, dict)
        amount = from_str(obj.get("amount"))
        currency = from_str(obj.get("currency"))
        rail = Rail(obj.get("rail"))
        chain = from_union([from_str, from_none], obj.get("chain"))
        receipt_url = from_union([from_str, from_none], obj.get("receipt_url"))
        tx_hash = from_union([from_str, from_none], obj.get("tx_hash"))
        return Payment(amount, currency, rail, chain, receipt_url, tx_hash)

    def to_dict(self) -> dict:
        result: dict = {}
        result["amount"] = from_str(self.amount)
        result["currency"] = from_str(self.currency)
        result["rail"] = to_enum(Rail, self.rail)
        if self.chain is not None:
            result["chain"] = from_union([from_str, from_none], self.chain)
        if self.receipt_url is not None:
            result["receipt_url"] = from_union([from_str, from_none], self.receipt_url)
        if self.tx_hash is not None:
            result["tx_hash"] = from_union([from_str, from_none], self.tx_hash)
        return result


class RaterClass(Enum):
    AUDIT = "audit"
    EXTERNAL = "external"
    SELF = "self"


@dataclass
class Rating:
    rater_class: Optional[RaterClass] = None
    stars: Optional[float] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Rating':
        assert isinstance(obj, dict)
        rater_class = from_union([RaterClass, from_none], obj.get("rater_class"))
        stars = from_union([from_float, from_none], obj.get("stars"))
        return Rating(rater_class, stars)

    def to_dict(self) -> dict:
        result: dict = {}
        if self.rater_class is not None:
            result["rater_class"] = from_union([lambda x: to_enum(RaterClass, x), from_none], self.rater_class)
        if self.stars is not None:
            result["stars"] = from_union([to_float, from_none], self.stars)
        return result


@dataclass
class Signatures:
    foxbook_sig: str
    """JWS counter-signature from Foxbook."""

    hirer_sig: str
    """JWS signature from hirer."""

    hiree_sig: Optional[str] = None
    """JWS signature from hiree (optional for failed hires)."""

    @staticmethod
    def from_dict(obj: Any) -> 'Signatures':
        assert isinstance(obj, dict)
        foxbook_sig = from_str(obj.get("foxbook_sig"))
        hirer_sig = from_str(obj.get("hirer_sig"))
        hiree_sig = from_union([from_str, from_none], obj.get("hiree_sig"))
        return Signatures(foxbook_sig, hirer_sig, hiree_sig)

    def to_dict(self) -> dict:
        result: dict = {}
        result["foxbook_sig"] = from_str(self.foxbook_sig)
        result["hirer_sig"] = from_str(self.hirer_sig)
        if self.hiree_sig is not None:
            result["hiree_sig"] = from_union([from_str, from_none], self.hiree_sig)
        return result


class Outcome(Enum):
    FAILURE = "failure"
    PARTIAL = "partial"
    SUCCESS = "success"


@dataclass
class Task:
    capability: str
    """Capability slug (e.g. json-repair, transcription). Canonical list lives in
    schemas/capabilities.v1.json.
    """
    outcome: Outcome
    latency_ms: Optional[int] = None
    summary: Optional[str] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Task':
        assert isinstance(obj, dict)
        capability = from_str(obj.get("capability"))
        outcome = Outcome(obj.get("outcome"))
        latency_ms = from_union([from_int, from_none], obj.get("latency_ms"))
        summary = from_union([from_str, from_none], obj.get("summary"))
        return Task(capability, outcome, latency_ms, summary)

    def to_dict(self) -> dict:
        result: dict = {}
        result["capability"] = from_str(self.capability)
        result["outcome"] = to_enum(Outcome, self.outcome)
        if self.latency_ms is not None:
            result["latency_ms"] = from_union([from_int, from_none], self.latency_ms)
        if self.summary is not None:
            result["summary"] = from_union([from_str, from_none], self.summary)
        return result


@dataclass
class TransparencyLogEntry:
    leaf_hash: str
    leaf_index: int
    log_id: str

    @staticmethod
    def from_dict(obj: Any) -> 'TransparencyLogEntry':
        assert isinstance(obj, dict)
        leaf_hash = from_str(obj.get("leaf_hash"))
        leaf_index = from_int(obj.get("leaf_index"))
        log_id = from_str(obj.get("log_id"))
        return TransparencyLogEntry(leaf_hash, leaf_index, log_id)

    def to_dict(self) -> dict:
        result: dict = {}
        result["leaf_hash"] = from_str(self.leaf_hash)
        result["leaf_index"] = from_int(self.leaf_index)
        result["log_id"] = from_str(self.log_id)
        return result


@dataclass
class Envelope:
    """Canonical envelope for every hire-and-report event published to foxbook.dev/live. DRAFT —
    content freezes day 7–9 per PROJECT-PLAN.md. See foxbook-foundation.md §8.1.1 for the
    authoritative shape. Additive changes only within v1.x; breaking changes require
    envelope_version bump and ≥90-day deprecation (LOCKED.md).
    """
    envelope_version: EnvelopeVersion
    """Draft marker. Flips to "1.0" at freeze time (day 7–9)."""

    event_id: str
    """ULID-based event identifier prefixed fbx_."""

    event_type: EventType
    """Day-7 PR D additively introduces claim.verified + revocation.recorded for the first wired
    firehose events. The hire.* + delegation.announced shapes (hirer/hiree/task/payment/...)
    remain the strict envelope for hire events. Per-event-type required-field gating across
    the new event types lands as a pre-freeze refinement (PROJECT-PLAN Day 7-9). Today the
    firehose wire payload for claim.verified / revocation.recorded carries {event_type, did,
    leaf_index, leaf_hash, timestamp, ...} inside the firehose_events.payload jsonb column
    without strict required-field validation; that's a deliberate scope cut so PR D is a
    minimal additive bump.
    """
    hiree: Hiree
    hirer: Hiree
    payment: Payment
    published_at: datetime
    """When Foxbook fanned the event to the firehose. published_at - reported_at feeds the p95
    staleness SLO.
    """
    reported_at: datetime
    """When the agents finished settling, ISO-8601."""

    signatures: Signatures
    task: Task
    transparency_log_entry: TransparencyLogEntry
    delegation_context: Optional[DelegationContext] = None
    rating: Optional[Rating] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Envelope':
        assert isinstance(obj, dict)
        envelope_version = EnvelopeVersion(obj.get("envelope_version"))
        event_id = from_str(obj.get("event_id"))
        event_type = EventType(obj.get("event_type"))
        hiree = Hiree.from_dict(obj.get("hiree"))
        hirer = Hiree.from_dict(obj.get("hirer"))
        payment = Payment.from_dict(obj.get("payment"))
        published_at = from_datetime(obj.get("published_at"))
        reported_at = from_datetime(obj.get("reported_at"))
        signatures = Signatures.from_dict(obj.get("signatures"))
        task = Task.from_dict(obj.get("task"))
        transparency_log_entry = TransparencyLogEntry.from_dict(obj.get("transparency_log_entry"))
        delegation_context = from_union([DelegationContext.from_dict, from_none], obj.get("delegation_context"))
        rating = from_union([Rating.from_dict, from_none], obj.get("rating"))
        return Envelope(envelope_version, event_id, event_type, hiree, hirer, payment, published_at, reported_at, signatures, task, transparency_log_entry, delegation_context, rating)

    def to_dict(self) -> dict:
        result: dict = {}
        result["envelope_version"] = to_enum(EnvelopeVersion, self.envelope_version)
        result["event_id"] = from_str(self.event_id)
        result["event_type"] = to_enum(EventType, self.event_type)
        result["hiree"] = to_class(Hiree, self.hiree)
        result["hirer"] = to_class(Hiree, self.hirer)
        result["payment"] = to_class(Payment, self.payment)
        result["published_at"] = self.published_at.isoformat()
        result["reported_at"] = self.reported_at.isoformat()
        result["signatures"] = to_class(Signatures, self.signatures)
        result["task"] = to_class(Task, self.task)
        result["transparency_log_entry"] = to_class(TransparencyLogEntry, self.transparency_log_entry)
        if self.delegation_context is not None:
            result["delegation_context"] = from_union([lambda x: to_class(DelegationContext, x), from_none], self.delegation_context)
        if self.rating is not None:
            result["rating"] = from_union([lambda x: to_class(Rating, x), from_none], self.rating)
        return result


def envelope_from_dict(s: Any) -> Envelope:
    return Envelope.from_dict(s)


def envelope_to_dict(x: Envelope) -> Any:
    return to_class(Envelope, x)

