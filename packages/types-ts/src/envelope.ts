// AUTO-GENERATED — do not hand-edit.
// Source: schemas/envelope/v1.json
// Regenerate via `pnpm generate:types`.
/**
 * Canonical envelope for every event published on the Foxbook firehose. Additive changes only within v1.x; breaking changes require envelope_version bump and ≥90-day deprecation.
 */
export interface FoxbookFirehoseEnvelopeV1 {
  /**
   * Draft marker. Flips to "1.0" at freeze time.
   */
  envelope_version: "1.0-draft";
  /**
   * ULID-based event identifier prefixed fbx_.
   */
  event_id: string;
  /**
   * Event type for the firehose payload. claim.verified + revocation.recorded are emitted by the verification + revocation flows. The hire.* + delegation.announced shapes carry the strict hirer/hiree/task/payment envelope. Per-event-type required-field gating across the verification/revocation event types is a future refinement; today their wire payload carries {event_type, did, leaf_index, leaf_hash, timestamp, ...} inside the firehose_events.payload jsonb column without strict required-field validation.
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
