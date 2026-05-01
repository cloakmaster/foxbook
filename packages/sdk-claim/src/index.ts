// @foxbook/sdk-claim — TypeScript reference SDK for the Foxbook claim
// flow + verification.
//
// Six functions:
//   * claimStart          POST /api/v1/claim/start
//   * claimVerifyGist     POST /api/v1/claim/verify-gist (tier-1)
//   * claimRevoke         POST /api/v1/claim/revoke
//   * verify              transparency-log inclusion-proof primitive
//   * foxbookVerify       handle → {tier, revoked, did, leafIndex}
//   * verifyAgentCard     runtime-safety gate before agent-to-agent calls
//
// All functions return discriminated unions. Network / non-JSON /
// unexpected-HTTP paths fold into {status: "error"} (claim) or
// {valid: false} (verify) so callers always get a typed result rather
// than an exception.
//
// No numeric trust score in any return shape. Verification (objective,
// cryptographic) is kept separate from reputation (subjective).
//
// See README.md for install + the A2A Discussion #1803 design context.

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
  type AssetType,
  type ClaimedTier,
  DEFAULT_WORKER_BASE,
  type FoxbookVerifyInput,
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
