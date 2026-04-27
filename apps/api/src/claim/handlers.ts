// Claim-flow handlers. Pure logic — DB + Gist + Merkle are injected
// through the deps so tests drive the exact same handler with a
// fake repo / fake verifier / fake appender.

import { jwsVerify, mintDid, sha256Hex } from "@foxbook/core";
import { validateTlLeaf } from "@foxbook/validators";

import type {
  ClaimRepository,
  ClaimRevokeInput,
  ClaimRevokeResult,
  ClaimStartInput,
  ClaimStartResult,
  ClaimVerifyGistInput,
  ClaimVerifyGistResult,
  GistVerifier,
  RevocationCommitter,
  VerificationCommitter,
} from "./types.js";
import { mintVerificationCode } from "./verification-code.js";

export type ClaimDeps = {
  claimRepo: ClaimRepository;
  gist: GistVerifier;
  /** Atomic-tx surface for POST /claim/verify-gist. Production wiring
   * lives in ./verification-committer.ts; tests inject a vi.fn that
   * records the call + returns a stubbed MerkleAppendResult. See
   * VerificationCommitter docs for the tx-context hygiene rules a real
   * implementation MUST honour (ADR 0004 addendum-1 + addendum-2). */
  verificationCommitter: VerificationCommitter;
  /** Atomic-tx surface for POST /claim/revoke. Production wiring lives
   * in ./revocation-committer.ts; tests inject a vi.fn that records
   * the call. See RevocationCommitter docs for the tx-context hygiene
   * rules a real implementation MUST honour (ADR 0004 addendum-1). */
  revocationCommitter: RevocationCommitter;
};

// ---- Local JWS helpers (base64url decode is not exported by @foxbook/core; ----
// keeping it inline here so the handler doesn't reach into core internals).

const textDecoder = new TextDecoder();

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((s.length + 3) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

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

  // Hand off to the verification committer — the atomic-tx surface
  // (claim state update + keys insert + merkle.append({tx}) + firehose
  // insert, all inside ONE db.transaction). Closes the Day-5 non-
  // atomicity gap. See verification-committer.ts for the tx body and
  // ADR 0004 addendum-1 + addendum-2 for the hygiene rules.
  try {
    const appendResult = await deps.verificationCommitter({ claim, leafPayload });
    return {
      ok: true,
      tier: 1,
      leafIndex: appendResult.leafIndex,
      leafHash: appendResult.leafHash,
      rootAfter: appendResult.rootAfter,
      sthJws: appendResult.sthJws,
    };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * POST /api/v1/claim/revoke — recovery-key-signed revocation flow.
 *
 * Sequence:
 *   1. Find claim. 404 if absent.
 *   2. State must be tier1_verified (only verified claims can be revoked
 *      in v0; gist_pending claims have no Merkle leaf to revoke against).
 *   3. Decode the JWS — header MUST carry an OKP/Ed25519 jwk so the
 *      verifier knows which public key to check the signature against
 *      AND the SHA-256 fingerprint matches claim.recovery_key_fingerprint.
 *   4. Verify the JWS signature via @foxbook/core's jwsVerify (which
 *      uses the SAME canonical-bytes rule as the signer).
 *   5. Authoritative re-bind: payload.did === claim.agent_did and
 *      payload.revoked_key_hex === claim.ed25519_public_key_hex. Without
 *      these, a recovery-key holder could revoke a DIFFERENT key/did
 *      via the same claim row.
 *   6. Build the full leaf (payload + recovery_key_signature) in
 *      alphabetical key order so canonical bytes are deterministic
 *      across signers/verifiers.
 *   7. validateTlLeaf gates on $defs/revocation shape.
 *   8. Hand off to deps.revocationCommitter — the atomic-tx surface
 *      (merkle.append({tx}) + INSERT firehose_events + DELETE claims).
 */
export async function claimRevoke(
  input: ClaimRevokeInput,
  deps: ClaimDeps,
): Promise<ClaimRevokeResult> {
  const claim = await deps.claimRepo.findById(input.claimId);
  if (!claim) return { ok: false, status: "not-found-claim" };
  if (claim.state !== "tier1_verified") {
    return { ok: false, status: "bad-state", currentState: claim.state };
  }

  const parts = input.revocationRecordJws.split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: "JWS not 3-segment compact form",
    };
  }
  const headerB64 = parts[0] as string;
  const payloadB64 = parts[1] as string;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(textDecoder.decode(base64urlDecode(headerB64))) as Record<string, unknown>;
    payload = JSON.parse(textDecoder.decode(base64urlDecode(payloadB64))) as Record<
      string,
      unknown
    >;
  } catch {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: "JWS header/payload not valid base64url JSON",
    };
  }

  if (header.alg !== "EdDSA") {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: `JWS alg "${String(header.alg)}" not supported (require EdDSA)`,
    };
  }
  const jwk = header.jwk as { kty?: unknown; crv?: unknown; x?: unknown } | undefined;
  if (
    !jwk ||
    typeof jwk !== "object" ||
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.x !== "string"
  ) {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: "JWS header missing or malformed jwk (require OKP/Ed25519/x)",
    };
  }
  const recoveryPubBytes = base64urlDecode(jwk.x);
  if (recoveryPubBytes.length !== 32) {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: `recovery key bytes wrong length: ${recoveryPubBytes.length} (expect 32 for Ed25519)`,
    };
  }

  // Match the recovery-key fingerprint that was stored at claim time.
  // claim.recovery_key_fingerprint is `sha256:<64-hex>` per x-foxbook
  // schema's recoveryKeyFingerprint pattern.
  const expectedFingerprint = `sha256:${sha256Hex(recoveryPubBytes)}`;
  if (expectedFingerprint !== claim.recoveryKeyFingerprint) {
    return {
      ok: false,
      status: "recovery-key-mismatch",
      reason: "JWS jwk fingerprint does not match claim.recovery_key_fingerprint",
    };
  }

  // Verify signature over the JWS signing input. jwsVerify uses the SAME
  // canonical-bytes rule as jwsSign — caller's key order in the payload
  // is what gets signed, byte-for-byte.
  let verifyResult: { valid: boolean };
  try {
    verifyResult = jwsVerify(input.revocationRecordJws, recoveryPubBytes);
  } catch (e) {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: e instanceof Error ? e.message : "jwsVerify threw",
    };
  }
  if (!verifyResult.valid) {
    return {
      ok: false,
      status: "recovery-key-signature-invalid",
      reason: "JWS signature did not verify against jwk.x",
    };
  }

  // Authoritative re-bind: payload must reference THIS claim, not any
  // other did/key combination.
  if (payload.did !== claim.agentDid) {
    return {
      ok: false,
      status: "invalid-leaf",
      reason: `payload did "${String(payload.did)}" does not match claim agent_did "${claim.agentDid}"`,
    };
  }
  if (payload.revoked_key_hex !== claim.ed25519PublicKeyHex) {
    return {
      ok: false,
      status: "invalid-leaf",
      reason: "payload revoked_key_hex does not match claim ed25519_public_key_hex",
    };
  }

  // Build the FULL leaf for storage. Field order is alphabetical so
  // canonical bytes are deterministic across signers/verifiers/scouts.
  // Verifiers reconstruct THIS shape from the wire and re-hash through
  // canonical.ts to validate inclusion proofs (ADR 0005).
  const fullLeaf: Record<string, unknown> = {
    did: payload.did,
    leaf_type: "revocation",
  };
  if (payload.reason_code !== undefined) {
    fullLeaf.reason_code = payload.reason_code;
  }
  fullLeaf.recovery_key_signature = input.revocationRecordJws;
  fullLeaf.revocation_timestamp = payload.revocation_timestamp;
  fullLeaf.revoked_key_hex = payload.revoked_key_hex;

  const validation = validateTlLeaf(fullLeaf);
  if (!validation.valid) {
    return {
      ok: false,
      status: "invalid-leaf",
      reason: `tl-leaf validation failed: ${validation.errors
        .map((e) => `${e.path} ${e.message}`)
        .join("; ")}`,
    };
  }

  // Atomic tx: leaf append + firehose event + claim delete. The
  // committer is responsible for honouring ADR 0004 addendum-1's
  // tx-context hygiene rule (no fetch, no adapter, no sleep).
  const result = await deps.revocationCommitter({ claim, fullLeaf });

  return {
    ok: true,
    revoked: true,
    leafIndex: result.leafIndex,
    leafHash: result.leafHash,
    sthJws: result.sthJws,
  };
}
