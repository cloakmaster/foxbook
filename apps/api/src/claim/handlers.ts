// Claim-flow handlers. Pure logic — DB + Gist + Merkle are injected
// through the deps so tests drive the exact same handler with a
// fake repo / fake verifier / fake appender.

import { mintDid } from "@foxbook/core";
import { validateTlLeaf } from "@foxbook/validators";

import type {
  ClaimRepository,
  ClaimStartInput,
  ClaimStartResult,
  ClaimVerifyGistInput,
  ClaimVerifyGistResult,
  GistVerifier,
  MerkleAppender,
} from "./types.js";
import { mintVerificationCode } from "./verification-code.js";

export type ClaimDeps = {
  claimRepo: ClaimRepository;
  gist: GistVerifier;
  merkle: MerkleAppender;
};

/**
 * POST /api/v1/claim/start — mint a verification code, insert a
 * gist_pending claim row. Returns 409 (asset-conflict) if (asset_type,
 * asset_value) is already claimed.
 */
export async function claimStart(
  input: ClaimStartInput,
  deps: ClaimDeps,
): Promise<ClaimStartResult> {
  const agentDid = input.agentDid ?? mintDid();
  const verificationCode = mintVerificationCode();

  const inserted = await deps.claimRepo.insertClaim({
    agentDid,
    state: "gist_pending",
    assetType: input.assetType,
    assetValue: input.assetValue,
    ed25519PublicKeyHex: input.ed25519PublicKeyHex,
    recoveryKeyFingerprint: input.recoveryKeyFingerprint,
    verificationCode,
  });

  if (!inserted.ok) {
    return { ok: false, status: inserted.status };
  }

  const fullRow = await deps.claimRepo.findById(inserted.id);
  if (!fullRow) {
    // Shouldn't happen — the insert just succeeded.
    throw new Error(`claim ${inserted.id} vanished between insert and lookup`);
  }

  return { ok: true, claim: fullRow };
}

/**
 * POST /api/v1/claim/verify-gist — single-attempt Gist polling. Caller
 * retries with backoff on still-pending. On match + identity-match +
 * validator-pass, transitions to tier1_verified, inserts the signing
 * key row, and writes the first agent-key-registration leaf to the
 * Merkle log.
 */
export async function claimVerifyGist(
  input: ClaimVerifyGistInput,
  deps: ClaimDeps,
): Promise<ClaimVerifyGistResult> {
  const claim = await deps.claimRepo.findById(input.claimId);
  if (!claim) {
    return { ok: false, status: "not-found-claim" };
  }
  if (claim.state !== "gist_pending") {
    return {
      ok: false,
      status: "bad-request",
      reason: `claim state is ${claim.state}, not gist_pending`,
    };
  }
  if (claim.assetType !== "github_handle") {
    // This route is Gist-only. Other asset types (X handle, domain)
    // have their own Tier-2 paths in Day 6.
    return { ok: false, status: "wrong-asset-type", assetType: claim.assetType };
  }

  const verify = await deps.gist.verifyGistContainsCode(
    input.gistUrl,
    claim.verificationCode,
    claim.assetValue,
  );

  if (verify.status !== "match") {
    // Pass through the adapter's discriminated status verbatim.
    const base = { ok: false as const, status: verify.status };
    return verify.reason !== undefined ? { ...base, reason: verify.reason } : base;
  }

  // Build the agent-key-registration leaf. Order + keys MUST exactly
  // match schemas/tl-leaf.v1.json#/$defs/agentKeyRegistration — any
  // drift means every scout's Python verifyInclusion fails against
  // our leafHash.
  const leafPayload = {
    leaf_type: "agent-key-registration" as const,
    did: claim.agentDid,
    ed25519_public_key_hex: claim.ed25519PublicKeyHex,
    recovery_key_fingerprint: claim.recoveryKeyFingerprint,
    published_at: new Date().toISOString(),
  };

  // Validator BEFORE append. If the payload shape ever drifts, the
  // append must not happen — a malformed leaf can't be reverted
  // without publishing a retraction event (which v0 doesn't have).
  const vr = validateTlLeaf(leafPayload);
  if (!vr.valid) {
    return {
      ok: false,
      status: "error",
      reason: `tl-leaf payload failed validation: ${vr.errors.map((e) => `${e.path} ${e.message}`).join("; ")}`,
    };
  }

  // State transition + keys row + Merkle leaf. The append is the
  // authoritative timestamp of tier1 — we reach it only if every
  // prior check passed.
  await deps.claimRepo.markTier1Verified(claim.id);
  await deps.claimRepo.insertSigningKey(claim.agentDid, claim.ed25519PublicKeyHex);

  const appendResult = await deps.merkle.append(leafPayload);

  return {
    ok: true,
    tier: 1,
    leafIndex: appendResult.leafIndex,
    leafHash: appendResult.leafHash,
    rootAfter: appendResult.rootAfter,
    sthJws: appendResult.sthJws,
  };
}
