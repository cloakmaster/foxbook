// Verification primitives + agent-hiring-gate convenience wrappers.
//
// Three functions:
//
//   verify              — primitive: leaf_index → {valid, root, leaf_hash}
//   foxbookVerify       — handle → {tier, revoked, did, leafIndex} (or not-claimed)
//   verifyAgentCard     — runtime-safety gate before any agent-to-agent call
//
// The agent-hiring-gate framing: in production code, the wrapper is
//
//   const v = await verifyAgentCard(card, opts);
//   if (v.status !== "verified") {
//     // block, log, fall through to caller's risk policy
//     return;
//   }
//   // proceed with agent-to-agent call
//
// The four discriminated outcomes map to {allowed, blocked, blocked,
// warning}. This is the API the RFC + outreach DMs +
// docs/distribution.md all reference — six functions, ~130 LOC public
// surface, no numeric trust scores anywhere in the response shape.
//
// **No numeric trust score**: PROJECT-PLAN.md Cross-LLM Strategic
// Feedback rejected aggregate scoring as a sneak-path that conflates
// verification (objective, cryptographic) with reputation
// (subjective, deferred). Future planners MUST NOT re-propose without
// an ADR amendment that addresses ADR 0006 §4 path-ordering.

// ---- Common ----

import type { Ed25519PublicKeyHex, FoxbookDid } from "./claim.js";

/** Default transparency-log Worker base. Reference deployment until
 *  transparency.foxbook.dev DNS lands (week 2+). */
export const DEFAULT_WORKER_BASE = "https://foxbook-transparency.inkog-io.workers.dev";

// ---- verify (primitive) ----

export type VerifyInput = {
  leaf_index: number;
  /** Override transparency Worker base. Defaults to DEFAULT_WORKER_BASE. */
  worker_base?: string;
};

export type VerifyResult =
  | { valid: true; leaf_index: number; root_hex: string; leaf_hash: string }
  | { valid: false; reason: string };

/**
 * Resolve {leaf_index → leaf bytes + inclusion proof + root}. Mirrors
 * the public Worker `/inclusion/:index` + `/root` contract from
 * apps/transparency. The caller can independently re-hash the leaf
 * preimage and walk the proof to verify root membership.
 *
 * @throws Error("not implemented") — Day-7 PR E ships signatures only.
 */
export async function verify(_input: VerifyInput): Promise<VerifyResult> {
  throw new Error("@foxbook/sdk-claim: verify not implemented (week-2 Distribution Track)");
}

// ---- foxbookVerify (handle-level convenience wrapper) ----

export type FoxbookVerifyOptions = {
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
  /** Override transparency Worker base. Defaults to DEFAULT_WORKER_BASE. */
  worker_base?: string;
};

/**
 * The claimed-tier discriminator. Tier-1 today is the only attestable
 * tier in the transparency log; Tier-2 / Tier-3 are app-state-only
 * pending the v1.1 tier-upgrade leaf type (PR C body's filed
 * security-model asymmetry).
 */
export type ClaimedTier = 1 | 2 | 3;

/**
 * Result shape — discriminated by `tier` presence. Returns
 * verification status only — NOT a numeric trust score (REJECTED per
 * PROJECT-PLAN.md Cross-LLM Strategic Feedback). Aggregate
 * reputation/scoring belongs in a separate surface, gated on its own
 * ADR amendment to ADR 0006 §4.
 */
export type FoxbookVerifyResult =
  | { tier: ClaimedTier; revoked: boolean; did: FoxbookDid; leafIndex: number }
  | { status: "not-claimed" }
  | { status: "error"; reason: string };

/**
 * Look up a handle (github username, X handle, or domain) and return
 * its current claim tier + revocation status. Resolves
 * {handle → claim row → optional leaf_index}.
 *
 * @throws Error("not implemented") — Day-7 PR E ships signatures only.
 */
export async function foxbookVerify(
  _handle: string,
  _options?: FoxbookVerifyOptions,
): Promise<FoxbookVerifyResult> {
  throw new Error("@foxbook/sdk-claim: foxbookVerify not implemented (week-2 Distribution Track)");
}

// ---- verifyAgentCard (agent-hiring-gate runtime-safety primitive) ----

/**
 * The minimum AgentCard shape `verifyAgentCard` reads. Mirrors A2A's
 * `AgentCard` with the `x-foxbook` extension; we keep the type narrow
 * so callers can pass partial cards without TS friction.
 */
export type VerifiableAgentCard = {
  /** Handle the card claims to belong to (github_handle, x_handle, or
   *  domain). The agent-hiring-gate handle-mismatch check binds this
   *  to the claim row's asset_value. */
  handle?: string;
  "x-foxbook"?: {
    did?: FoxbookDid;
    foxbook_url?: string;
    verification_tier?: number;
    signatures?: {
      ed25519_public_key_hex?: Ed25519PublicKeyHex;
      transparency_log_entry?: string;
    };
  };
};

export type VerifyAgentCardOptions = {
  /** If true, refuse `verified` unless an inclusion proof is fetched
   *  from the transparency Worker. Defaults to true — Day-7 default
   *  is "evidence over assertion." */
  requireInclusionProof?: boolean;
  /** If set, refuse `verified` when the STH is older than this
   *  threshold (in seconds). Useful for high-stakes agent-to-agent
   *  calls where freshness matters. Defaults to undefined (any age
   *  passes). */
  requireFreshSTH?: number;
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
  /** Override transparency Worker base. Defaults to DEFAULT_WORKER_BASE. */
  worker_base?: string;
};

/**
 * Four-way discriminated agent-hiring-gate outcome. Maps to the
 * caller's run-time policy as:
 *
 *   verified         → allowed
 *   unverified       → blocked
 *   handle-mismatch  → blocked (the card claims a handle the
 *                       transparency log does NOT attest)
 *   stale-proof      → warning (caller decides; e.g. refresh + retry)
 *
 * **No numeric trust score** in any branch. The four discriminated
 * outcomes are the entire surface; a future planner cannot smuggle
 * `{trust_score: number}` in here without an ADR amendment to ADR
 * 0006 §4.
 */
export type VerifyAgentCardResult =
  | { status: "verified"; tier: ClaimedTier; did: FoxbookDid; leafIndex: number }
  | { status: "unverified"; reason: string }
  | { status: "handle-mismatch"; claimed_handle: string; card_handle: string }
  | { status: "stale-proof"; proof_age_seconds: number; threshold_seconds: number };

/**
 * The runtime-safety primitive. Insert before any agent-to-agent
 * call:
 *
 *   const v = await verifyAgentCard(card, { requireFreshSTH: 3600 });
 *   if (v.status !== "verified") return blockOrWarn(v);
 *
 * Day-7 PR E ships the signature; the implementation in week 2 walks
 * the card → did → claim row → leaf-inclusion-proof chain and
 * discriminates the four outcomes.
 *
 * @throws Error("not implemented") — Day-7 PR E ships signatures only.
 */
export async function verifyAgentCard(
  _card: VerifiableAgentCard,
  _options?: VerifyAgentCardOptions,
): Promise<VerifyAgentCardResult> {
  throw new Error(
    "@foxbook/sdk-claim: verifyAgentCard not implemented (week-2 Distribution Track)",
  );
}
