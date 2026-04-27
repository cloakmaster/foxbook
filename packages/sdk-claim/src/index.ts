// @foxbook/sdk-claim — TypeScript reference SDK for Foxbook claim
// flow + verification.
//
// Six-function public surface:
//   * claimStart          POST /api/v1/claim/start
//   * claimVerifyGist     POST /api/v1/claim/verify-gist (tier-1)
//   * claimRevoke         POST /api/v1/claim/revoke
//   * verify              transparency-log inclusion-proof primitive
//   * foxbookVerify       handle → {tier, revoked, did, leafIndex}
//   * verifyAgentCard     runtime-safety gate (agent-hiring-gate framing)
//
// Day-7 PR E ships SIGNATURES + DISCRIMINATED-UNION TYPES ONLY.
// Function bodies stub `throw new Error("not implemented")`. The
// implementation lands in week 2 per PROJECT-PLAN.md Distribution
// Track.
//
// Why ship signatures alone now: the RFC text
// (docs/rfc-a2a-x-foxbook-extension.md), outreach DMs
// (docs/outreach.md), and docs/distribution.md all reference these
// six functions as the contract. If they shift in week 2, every
// referencing artifact becomes stale before it's even sent.
//
// **No numeric trust score** in any return shape. PROJECT-PLAN.md
// Cross-LLM Strategic Feedback rejected aggregate scoring as a sneak-
// path that conflates verification (objective, cryptographic) with
// reputation (subjective, deferred). The wrappers return discriminated
// unions only; future planners MUST NOT re-propose without an ADR
// amendment that addresses ADR 0006 §4 path-ordering.

export {
  type ClaimRevokeInput,
  type ClaimRevokeResult,
  type ClaimStartInput,
  type ClaimStartResult,
  type ClaimVerifyGistInput,
  type ClaimVerifyGistResult,
  claimRevoke,
  claimStart,
  claimVerifyGist,
  DEFAULT_API_BASE,
  type Ed25519PublicKeyHex,
  type FoxbookDid,
  type RecoveryKeyFingerprint,
  type VerificationCode,
} from "./claim.js";

export {
  type ClaimedTier,
  DEFAULT_WORKER_BASE,
  type FoxbookVerifyOptions,
  type FoxbookVerifyResult,
  foxbookVerify,
  type VerifiableAgentCard,
  type VerifyAgentCardOptions,
  type VerifyAgentCardResult,
  type VerifyInput,
  type VerifyResult,
  verify,
  verifyAgentCard,
} from "./verify.js";
