// AUTO-GENERATED — do not hand-edit.
// Source: schemas/agent-card.v1.json
// Regenerate via `pnpm generate:types`.
/**
 * Google A2A AgentCard pinned to upstream v0.3.0 (protocolVersion == "0.3.0", source: github.com/a2aproject/a2a-js @ v0.3.0, validated against @a2a-js/sdk AgentCard type 2026-04-22). Foxbook mirrors the shape used in practice by the published A2A SDKs rather than attempting to replicate the full RFC; extensions land under `x-foxbook` ($ref x-foxbook.v1.json) to stay A2A-forward-compatible. NOTE: top-level `additionalProperties` is intentionally omitted (not set to true, not set to false) so unknown A2A v0.3.x optional fields (e.g. additionalInterfaces, supportsAuthenticatedExtendedCard) pass through without breaking the validator — this is the single controlled deviation from the `no additionalProperties: true on top-level` rule and is required for A2A forward-compat.
 */
export interface A2AAgentCardFoxbookMirroredV1 {
  name: string;
  description: string;
  url: string;
  version: string;
  /**
   * A2A spec version. We pin v0.3.0 in v1; a future v0.4.x would land behind an `agent-card.v2.json` schema file, not an in-place edit.
   */
  protocolVersion: "0.3.0";
  provider?: {
    organization?: string;
    url?: string;
  };
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  /**
   * @minItems 1
   */
  skills: [
    {
      id: string;
      name: string;
      description: string;
      tags?: string[];
    },
    ...{
      id: string;
      name: string;
      description: string;
      tags?: string[];
    }[]
  ];
  authentication?: {
    schemes?: string[];
  };
  /**
   * @minItems 1
   */
  defaultInputModes: [string, ...string[]];
  /**
   * @minItems 1
   */
  defaultOutputModes: [string, ...string[]];
  additionalInterfaces?: {
    url: string;
    transport: "JSONRPC" | "HTTP+JSON" | "GRPC";
  }[];
  "x-foxbook"?: FoxbookAgentCardExtensionXFoxbookV1;
}
/**
 * Foxbook-specific AgentCard extension fields, placed under the `x-foxbook` namespace inside an A2A AgentCard. Authoritative shape in docs/foundation/foxbook-foundation.md §6.2. Shared primitives (did, ed25519PublicKey, recoveryKeyFingerprint) are exposed via $defs so other schemas ($ref-in) don't duplicate their types.
 */
export interface FoxbookAgentCardExtensionXFoxbookV1 {
  /**
   * did:foxbook:{ULID} — uppercase Crockford base32, 26 chars. Matches core/src/did.ts regex.
   */
  did: string;
  /**
   * Canonical profile URL under foxbook.dev.
   */
  foxbook_url: string;
  /**
   * Tier 0–4 per foundation §6.5. Tier 5 (human-reviewed) is V3-only, not valid in V1.
   */
  verification_tier: number;
  verified_asset?: {
    type: "domain" | "x_handle" | "github_handle";
    value: string;
    verified_at: string;
    method: "dns_txt_plus_endpoint_challenge" | "github_gist" | "tweet" | "email" | "github_org";
  };
  human_owner?: {
    display_name?: string;
    handle?: string;
    verification_method?: "github_gist" | "tweet" | "email";
    verified_at?: string;
  };
  class_or_instance: "class" | "instance";
  instance_uuid?: string | null;
  /**
   * `sha256:` prefix + 64 lowercase hex chars. Content-hash pinning for version-scoped reputation (§6.7).
   */
  version_hash: string;
  agentic_turing_test?: {
    challenge_endpoint?: string;
    last_passed_at?: string;
    brain_health?: "green" | "yellow" | "red" | "unknown";
  };
  liveness?: {
    last_heartbeat?: string;
    status?: "live" | "stale" | "offline" | "revoked";
    uptime_30d?: number;
  };
  payment_rails?: {
    type: "x402" | "ap2" | "stripe_mpp";
    facilitator?: string;
    asset?: string;
    pricing_hint?: string;
    mandates_supported?: ("intent" | "cart")[];
    session_supported?: boolean;
  }[];
  /**
   * Explicit pricing signal. Presence of this object (together with a payment_rails entry) satisfies the scout-consent rule for unregistered third-party A2A cards (LOCKED.md).
   */
  pricing?: {
    /**
     * Decimal string, no float precision loss.
     */
    amount?: string;
    currency?: string;
    /**
     * e.g. per_1k_tokens, per_request, per_minute.
     */
    unit?: string;
  };
  sub_agent_dependencies?: {
    url: string;
    invoked_when?: string;
  }[];
  /**
   * Denormalised reputation snapshot; rendered on profile pages. Computed server-side so the shape is flexible across versions — additional fields allowed within this sub-object only.
   */
  reputation?: {
    [k: string]: unknown;
  };
  scout_rating?: {
    last_tested_at?: string;
    test_suite_version?: string;
    pass_rate?: number;
  };
  data_handling?: {
    pii_processing?: "none" | "transient" | "stored";
    log_retention?: string;
    jurisdiction?: string;
  };
  signatures: {
    /**
     * 32-byte Ed25519 public key, hex-encoded, lowercase. Matches RFC 8032 raw form.
     */
    ed25519_public_key_hex: string;
    /**
     * SHA-256 fingerprint of the recovery-key public bytes. Recovery key itself is never on-chain; only the fingerprint binds the agent to its recovery authority (§6.6).
     */
    recovery_key_fingerprint?: string;
    jws_signature: string;
    transparency_log_entry?: string;
  };
  attestations?: {}[];
  endorsements?: {}[];
  sigstore_attestation?: {} | null;
  revoked?: boolean;
  revoked_reason?: string | null;
  updated_at: string;
}
