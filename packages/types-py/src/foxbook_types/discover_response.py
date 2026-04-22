# AUTO-GENERATED — do not hand-edit.
# Source: schemas/discover-response.v1.json
# Regenerate via `pnpm generate:types`.
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Any, List, TypeVar, Type, Callable, cast


T = TypeVar("T")
EnumT = TypeVar("EnumT", bound=Enum)


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


def from_list(f: Callable[[Any], T], x: Any) -> List[T]:
    assert isinstance(x, list)
    return [f(y) for y in x]


def to_class(c: Type[T], x: Any) -> dict:
    assert isinstance(x, c)
    return cast(Any, x).to_dict()


class Rail(Enum):
    AP2 = "ap2"
    MPP = "mpp"
    X402 = "x402"


@dataclass
class Query:
    """Normalised echo of the caller's query parameters. Useful for caching + debugging."""

    capability: str
    budget_max_usd: Optional[str] = None
    latency_max_ms: Optional[int] = None
    limit: Optional[int] = None
    payment_rail: Optional[Rail] = None
    sub: Optional[str] = None
    tier: Optional[int] = None

    @staticmethod
    def from_dict(obj: Any) -> 'Query':
        assert isinstance(obj, dict)
        capability = from_str(obj.get("capability"))
        budget_max_usd = from_union([from_none, from_str], obj.get("budget_max_usd"))
        latency_max_ms = from_union([from_none, from_int], obj.get("latency_max_ms"))
        limit = from_union([from_int, from_none], obj.get("limit"))
        payment_rail = from_union([from_none, Rail], obj.get("payment_rail"))
        sub = from_union([from_none, from_str], obj.get("sub"))
        tier = from_union([from_none, from_int], obj.get("tier"))
        return Query(capability, budget_max_usd, latency_max_ms, limit, payment_rail, sub, tier)

    def to_dict(self) -> dict:
        result: dict = {}
        result["capability"] = from_str(self.capability)
        if self.budget_max_usd is not None:
            result["budget_max_usd"] = from_union([from_none, from_str], self.budget_max_usd)
        if self.latency_max_ms is not None:
            result["latency_max_ms"] = from_union([from_none, from_int], self.latency_max_ms)
        if self.limit is not None:
            result["limit"] = from_union([from_int, from_none], self.limit)
        if self.payment_rail is not None:
            result["payment_rail"] = from_union([from_none, lambda x: to_enum(Rail, x)], self.payment_rail)
        if self.sub is not None:
            result["sub"] = from_union([from_none, from_str], self.sub)
        if self.tier is not None:
            result["tier"] = from_union([from_none, from_int], self.tier)
        return result


class BrainHealth(Enum):
    GREEN = "green"
    RED = "red"
    YELLOW = "yellow"


@dataclass
class PricingHint:
    amount_usd: str
    rail: Rail
    unit: str

    @staticmethod
    def from_dict(obj: Any) -> 'PricingHint':
        assert isinstance(obj, dict)
        amount_usd = from_str(obj.get("amount_usd"))
        rail = Rail(obj.get("rail"))
        unit = from_str(obj.get("unit"))
        return PricingHint(amount_usd, rail, unit)

    def to_dict(self) -> dict:
        result: dict = {}
        result["amount_usd"] = from_str(self.amount_usd)
        result["rail"] = to_enum(Rail, self.rail)
        result["unit"] = from_str(self.unit)
        return result


@dataclass
class SampleWork:
    latency_ms: int
    rating: float
    task: str

    @staticmethod
    def from_dict(obj: Any) -> 'SampleWork':
        assert isinstance(obj, dict)
        latency_ms = from_int(obj.get("latency_ms"))
        rating = from_float(obj.get("rating"))
        task = from_str(obj.get("task"))
        return SampleWork(latency_ms, rating, task)

    def to_dict(self) -> dict:
        result: dict = {}
        result["latency_ms"] = from_int(self.latency_ms)
        result["rating"] = to_float(self.rating)
        result["task"] = from_str(self.task)
        return result


@dataclass
class DiscoverRespons:
    """One ranked agent in the response. Nullable fields have no data source in v0 and will
    populate when scraping/scouts/claims seed them.
    """
    capabilities: List[str]
    """Capability slugs + optional sub qualifiers, e.g.
    "language-translation:japanese-to-english".
    """
    did: str
    sample_work: List[SampleWork]
    """Recent representative tasks. Empty array in v0."""

    tier: int
    url: str
    agent_card_url: Optional[str] = None
    """Public URL of the A2A AgentCard JSON. Null until the claim flow publishes one."""

    brain_health: Optional[BrainHealth] = None
    """Agentic Turing Test rolling signal. Null in v0; populated once the heartbeat path lands."""

    endpoint: Optional[str] = None
    """A2A-compatible callable endpoint from the manifest. Null when manifest is not published
    yet.
    """
    latency_p50_ms: Optional[int] = None
    """Observed p50 latency across recent successful reports. Null in v0."""

    pricing_hint: Optional[PricingHint] = None
    """Derived from manifest pricing fields. Null when manifest omits pricing."""

    reputation: Optional[float] = None
    """Weighted composite of reputation score, tier, scout rating pass-rate, etc. Null in v0
    until reports + scouts seed the signal.
    """
    uptime_30_d: Optional[float] = None
    """Heartbeat uptime over the trailing 30 days, 0-1. Null in v0."""

    @staticmethod
    def from_dict(obj: Any) -> 'DiscoverRespons':
        assert isinstance(obj, dict)
        capabilities = from_list(from_str, obj.get("capabilities"))
        did = from_str(obj.get("did"))
        sample_work = from_list(SampleWork.from_dict, obj.get("sample_work"))
        tier = from_int(obj.get("tier"))
        url = from_str(obj.get("url"))
        agent_card_url = from_union([from_none, from_str], obj.get("agent_card_url"))
        brain_health = from_union([from_none, BrainHealth], obj.get("brain_health"))
        endpoint = from_union([from_none, from_str], obj.get("endpoint"))
        latency_p50_ms = from_union([from_none, from_int], obj.get("latency_p50_ms"))
        pricing_hint = from_union([from_none, PricingHint.from_dict], obj.get("pricing_hint"))
        reputation = from_union([from_none, from_float], obj.get("reputation"))
        uptime_30_d = from_union([from_none, from_float], obj.get("uptime_30d"))
        return DiscoverRespons(capabilities, did, sample_work, tier, url, agent_card_url, brain_health, endpoint, latency_p50_ms, pricing_hint, reputation, uptime_30_d)

    def to_dict(self) -> dict:
        result: dict = {}
        result["capabilities"] = from_list(from_str, self.capabilities)
        result["did"] = from_str(self.did)
        result["sample_work"] = from_list(lambda x: to_class(SampleWork, x), self.sample_work)
        result["tier"] = from_int(self.tier)
        result["url"] = from_str(self.url)
        result["agent_card_url"] = from_union([from_none, from_str], self.agent_card_url)
        result["brain_health"] = from_union([from_none, lambda x: to_enum(BrainHealth, x)], self.brain_health)
        result["endpoint"] = from_union([from_none, from_str], self.endpoint)
        result["latency_p50_ms"] = from_union([from_none, from_int], self.latency_p50_ms)
        result["pricing_hint"] = from_union([from_none, lambda x: to_class(PricingHint, x)], self.pricing_hint)
        result["reputation"] = from_union([from_none, to_float], self.reputation)
        result["uptime_30d"] = from_union([from_none, to_float], self.uptime_30_d)
        return result


class SchemaVersion(Enum):
    THE_10_DRAFT = "1.0-draft"


@dataclass
class DiscoverResponse:
    """Canonical response envelope for GET /api/v1/discover. See foxbook-foundation.md §7.1 for
    the source of truth. Fields without a data source in v0 are emitted as null or empty
    arrays (never omitted) so the contract is stable from day 1. Additive changes only within
    v1.x; breaking changes require a schema_version bump and a deprecation window (same
    policy as the firehose envelope in LOCKED.md).
    """
    query: Query
    """Normalised echo of the caller's query parameters. Useful for caching + debugging."""

    query_time_ms: int
    """Server-side time to assemble the response. Reality check against the p50 <500ms / p99
    <1.2s SLO.
    """
    results: List[DiscoverRespons]
    schema_version: SchemaVersion
    """Draft marker. Flips to "1.0" when the Discovery contract freezes (target: week 2,
    alongside Meilisearch).
    """
    total_matching: int
    """Count of agents matching the query across the full index, before `limit`."""

    @staticmethod
    def from_dict(obj: Any) -> 'DiscoverResponse':
        assert isinstance(obj, dict)
        query = Query.from_dict(obj.get("query"))
        query_time_ms = from_int(obj.get("query_time_ms"))
        results = from_list(DiscoverRespons.from_dict, obj.get("results"))
        schema_version = SchemaVersion(obj.get("schema_version"))
        total_matching = from_int(obj.get("total_matching"))
        return DiscoverResponse(query, query_time_ms, results, schema_version, total_matching)

    def to_dict(self) -> dict:
        result: dict = {}
        result["query"] = to_class(Query, self.query)
        result["query_time_ms"] = from_int(self.query_time_ms)
        result["results"] = from_list(lambda x: to_class(DiscoverRespons, x), self.results)
        result["schema_version"] = to_enum(SchemaVersion, self.schema_version)
        result["total_matching"] = from_int(self.total_matching)
        return result


def discover_response_from_dict(s: Any) -> DiscoverResponse:
    return DiscoverResponse.from_dict(s)


def discover_response_to_dict(x: DiscoverResponse) -> Any:
    return to_class(DiscoverResponse, x)

