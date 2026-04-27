// AUTO-GENERATED — do not hand-edit.
// Source: schemas/envelope/v1.json
// Regenerate via `pnpm generate:types`.
/**
 * Canonical envelope for every hire-and-report event published to foxbook.dev/live. DRAFT — content freezes day 7–9 per PROJECT-PLAN.md. See foxbook-foundation.md §8.1.1 for the authoritative shape. Additive changes only within v1.x; breaking changes require envelope_version bump and ≥90-day deprecation (LOCKED.md).
 */
export interface FoxbookFirehoseEnvelopeV1 {
  /**
   * Draft marker. Flips to "1.0" at freeze time (day 7–9).
   */
  envelope_version: "1.0-draft";
  /**
   * ULID-based event identifier prefixed fbx_.
   */
  event_id: string;
  /**
   * Day-7 PR D additively introduces claim.verified + revocation.recorded for the first wired firehose events. The hire.* + delegation.announced shapes (hirer/hiree/task/payment/...) remain the strict envelope for hire events. Per-event-type required-field gating across the new event types lands as a pre-freeze refinement (PROJECT-PLAN Day 7-9). Today the firehose wire payload for claim.verified / revocation.recorded carries {event_type, did, leaf_index, leaf_hash, timestamp, ...} inside the firehose_events.payload jsonb column without strict required-field validation; that's a deliberate scope cut so PR D is a minimal additive bump.
   */
  event_type:
    | "hire.settled"
    | "hire.failed"
    | "delegation.announced"
    | "claim.verified"
    | "revocation.recorded";
  /**
   * When the agents finished settling, ISO-8601.
   */
  reported_at: string;
  /**
   * When Foxbook fanned the event to the firehose. published_at - reported_at feeds the p95 staleness SLO.
   */
  published_at: string;
  hirer: AgentRef;
  hiree: AgentRef;
  task: {
    /**
     * Capability slug (e.g. json-repair, transcription). Canonical list lives in schemas/capabilities.v1.json.
     */
    capability: string;
    summary?: string;
    latency_ms?: number;
    outcome: "success" | "partial" | "failure";
  };
  rating?: {
    stars?: number;
    rater_class?: "external" | "self" | "audit";
  };
  payment: {
    rail: "x402" | "ap2" | "mpp";
    /**
     * Decimal string to avoid float precision issues.
     */
    amount: string;
    currency: string;
    chain?: string;
    tx_hash?: string;
    receipt_url?: string;
  };
  delegation_context?: {
    parent_event_id?: string | null;
    declared_sub_agent_deps?: string[];
  };
  transparency_log_entry: {
    log_id: string;
    leaf_index: number;
    leaf_hash: string;
  };
  signatures: {
    /**
     * JWS signature from hirer.
     */
    hirer_sig: string;
    /**
     * JWS signature from hiree (optional for failed hires).
     */
    hiree_sig?: string;
    /**
     * JWS counter-signature from Foxbook.
     */
    foxbook_sig: string;
  };
}
export interface AgentRef {
  did: string;
  url: string;
  verification_tier: number;
  version_hash: string;
}
