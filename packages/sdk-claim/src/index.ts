// @foxbook/sdk-claim — TypeScript reference SDK for Foxbook claim
// flow + verification.
//
// Six-function public surface:
//   * claimStart          POST /api/v1/claim/start
//   * claimVerifyGist     POST /api/v1/claim/verify-gist (tier-1)
//   * claimRevoke         POST /api/v1/claim/revoke
//   * verify              transparency-log inclusion-proof primitive
//   * foxbookVerify       handle → {tier, revoked, did, leafIndex}
//   * verifyAgentCard     runtime-safety gate before agent-to-agent calls
//
// Signatures + discriminated-union types committed. Function bodies
// stub `throw new Error("not implemented")` while the implementation
// is in progress.
//
// No numeric trust score in any return shape. The wrappers return
// discriminated unions only — verification (objective, cryptographic)
// is kept separate from reputation (subjective).

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
