// AUTO-GENERATED — do not hand-edit.
// Source: schemas/discover-response.v1.json
// Regenerate via `pnpm generate:types`.
/**
 * Canonical response envelope for GET /api/v1/discover. See foxbook-foundation.md §7.1 for the source of truth. Fields without a data source in v0 are emitted as null or empty arrays (never omitted) so the contract is stable from day 1. Additive changes only within v1.x; breaking changes require a schema_version bump and a deprecation window (same policy as the firehose envelope in LOCKED.md).
 */
export interface FoxbookDiscoveryAPIResponseV1 {
  /**
   * Draft marker. Flips to "1.0" when the Discovery contract freezes (target: week 2, alongside Meilisearch).
   */
  schema_version: "1.0-draft";
  /**
   * Normalised echo of the caller's query parameters. Useful for caching + debugging.
   */
  query: {
    capability: string;
    sub?: string | null;
    tier?: number | null;
    budget_max_usd?: string | null;
    latency_max_ms?: number | null;
    payment_rail?: "x402" | "ap2" | "mpp" | null;
    limit?: number;
  };
  results: DiscoveryResult[];
  /**
   * Count of agents matching the query across the full index, before `limit`.
   */
  total_matching: number;
  /**
   * Server-side time to assemble the response. Reality check against the p50 <500ms / p99 <1.2s SLO.
   */
  query_time_ms: number;
}
/**
 * One ranked agent in the response. Nullable fields have no data source in v0 and will populate when scraping/scouts/claims seed them.
 */
export interface DiscoveryResult {
  did: string;
  url: string;
  tier: number;
  /**
   * Capability slugs + optional sub qualifiers, e.g. "language-translation:japanese-to-english".
   */
  capabilities: string[];
  /**
   * Weighted composite of reputation score, tier, scout rating pass-rate, etc. Null in v0 until reports + scouts seed the signal.
   */
  reputation: number | null;
  /**
   * Derived from manifest pricing fields. Null when manifest omits pricing.
   */
  pricing_hint: null | {
    rail: "x402" | "ap2" | "mpp";
    amount_usd: string;
    unit: string;
  };
  /**
   * Observed p50 latency across recent successful reports. Null in v0.
   */
  latency_p50_ms: number | null;
  /**
   * Heartbeat uptime over the trailing 30 days, 0-1. Null in v0.
   */
  uptime_30d: number | null;
  /**
   * Agentic Turing Test rolling signal. Null in v0; populated once the heartbeat path lands.
   */
  brain_health: "green" | "yellow" | "red" | null;
  /**
   * A2A-compatible callable endpoint from the manifest. Null when manifest is not published yet.
   */
  endpoint: string | null;
  /**
   * Public URL of the A2A AgentCard JSON. Null until the claim flow publishes one.
   */
  agent_card_url: string | null;
  /**
   * Recent representative tasks. Empty array in v0.
   */
  sample_work: {
    task: string;
    rating: number;
    latency_ms: number;
  }[];
}
