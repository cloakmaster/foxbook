// AUTO-GENERATED — do not hand-edit.
// Source: schemas/claim-by-handle.v1.json
// Regenerate via `pnpm generate:types`.
/**
 * Read-only response shape for GET /api/v1/claim/by-handle/:asset_type/:asset_value. Returns the claim row + (when applicable) the latest agent-key-registration leaf index in the transparency log. Cache-Control: public, max-age=60, must-revalidate (per ADR 0007).
 */
export interface FoxbookApiV1ClaimByHandleResponseV1 {
  asset_type: "github_handle" | "x_handle" | "domain";
  asset_value: string;
  agent_did: string;
  state: "unclaimed" | "gist_pending" | "tier1_verified" | "tier2_pending" | "tier2_verified";
  /**
   * 0 = unclaimed/pending. 1 = tier1_verified (Gist). 2 = tier2_verified (DNS or endpoint). 3+ reserved for future tiers.
   */
  verification_tier: number;
  ed25519_public_key_hex: string;
  /**
   * Latest agent-key-registration leaf index in the transparency log. Present only when the claim is in tier1_verified or tier2_verified state.
   */
  leaf_index?: number;
  /**
   * Convenience: the public Worker URL for the inclusion proof at leaf_index. Present only when leaf_index is present.
   */
  inclusion_proof_url?: string;
  /**
   * Always false in v1 — revoked claims are deleted from the claims table per ADR 0004 addendum-1, so a 200 response from this endpoint always describes a non-revoked claim. The field is surfaced for forward compatibility with a future soft-revoke path.
   */
  revoked: boolean;
}
