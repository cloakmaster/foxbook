// Claim-flow handlers. Pure logic — DB + Gist + Merkle are injected
// through the deps so tests drive the exact same handler with a
// fake repo / fake verifier / fake appender.

import { jwsVerify, mintDid, sha256Hex } from "@foxbook/core";
import { validateTlLeaf } from "@foxbook/validators";

import type {
  ClaimRepository,
  ClaimRevokeInput,
  ClaimRevokeResult,
  ClaimStartDomainInput,
  ClaimStartDomainResult,
  ClaimStartInput,
  ClaimStartResult,
  ClaimVerifyDnsInput,
  ClaimVerifyDnsResult,
  ClaimVerifyEndpointInput,
  ClaimVerifyEndpointResult,
  ClaimVerifyGistInput,
  ClaimVerifyGistResult,
  DnsVerifier,
  EndpointVerifier,
  GistVerifier,
  MerkleAppender,
  RevocationCommitter,
} from "./types.js";
import { mintVerificationCode } from "./verification-code.js";

export type ClaimDeps = {
  claimRepo: ClaimRepository;
  gist: GistVerifier;
  /** Day-7 PR C — Tier 2 DNS verifier. Production wiring lives in
   *  apps/api/src/main.ts via @foxbook/adapter-dns; tests inject a
   *  hand-rolled fake. */
  dns: DnsVerifier;
  /** Day-7 PR C — Tier 2 endpoint-challenge verifier. Production
   *  wiring via @foxbook/adapter-endpoint-challenge; tests inject a
   *  hand-rolled fake. */
  endpoint: EndpointVerifier;
  merkle: MerkleAppender;
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

// ---- Tier 2 verification handlers (Day-7 PR C) ----

/**
 * POST /api/v1/claim/start-domain — domain-asset variant of /claim/start.
 *
 * Mints a verification_code, writes the claim row in tier2_pending state,
 * returns the code so the caller can publish it as a TXT record at
 * `_foxbook-claim.<domain>` (DNS path) or hold it for the endpoint-
 * challenge round-trip. Tier-2 today is app-state-only — no Merkle leaf
 * (security-model asymmetry; tier-upgrade additive $defs filed for v1.1
 * per PR C body).
 */
export async function claimStartDomain(
  input: ClaimStartDomainInput,
  deps: ClaimDeps,
): Promise<ClaimStartDomainResult> {
  const agentDid = input.agentDid ?? mintDid();
  const verificationCode = mintVerificationCode();

  const inserted = await deps.claimRepo.insertClaim({
    agentDid,
    state: "tier2_pending",
    assetType: "domain",
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
    throw new Error(`claim ${inserted.id} vanished between insert and lookup`);
  }
  return { ok: true, claim: fullRow };
}

/**
 * POST /api/v1/claim/verify-dns — single-attempt DNS TXT poll. Caller
 * retries with backoff on `still-pending`; the route handler does NOT
 * loop internally because that would block the request beyond reasonable
 * latency budgets.
 *
 * Discriminated statuses pass through verbatim from the DNS adapter:
 *   match              → tier2_verified, returns ok
 *   not-found          → NXDOMAIN; no retry sensible
 *   still-pending      → caller retries with 2s backoff (5x)
 *   identity-mismatch  → different agent's claim sits on this domain
 *   error / *          → transient (servfail, timeout, rate_limited)
 */
export async function claimVerifyDns(
  input: ClaimVerifyDnsInput,
  deps: ClaimDeps,
): Promise<ClaimVerifyDnsResult> {
  const claim = await deps.claimRepo.findById(input.claimId);
  if (!claim) return { ok: false, status: "not-found-claim" };
  if (claim.assetType !== "domain") {
    return { ok: false, status: "wrong-asset-type", assetType: claim.assetType };
  }
  if (claim.state !== "tier2_pending") {
    return { ok: false, status: "bad-state", currentState: claim.state };
  }

  const result = await deps.dns.verifyDnsTxtContainsCode(claim.assetValue, claim.verificationCode);

  if (result.status === "match") {
    await deps.claimRepo.markTier2Verified(claim.id);
    return { ok: true, tier: 2 };
  }
  if (result.status === "not-found") {
    return { ok: false, status: "not-found" };
  }
  if (result.status === "still-pending") {
    return { ok: false, status: "still-pending" };
  }
  if (result.status === "identity-mismatch") {
    return {
      ok: false,
      status: "identity-mismatch",
      reason: result.reason,
      foundCode: result.foundCode,
    };
  }
  // result.status === "error"
  return result.detail !== undefined
    ? { ok: false, status: "error", reason: result.reason, detail: result.detail }
    : { ok: false, status: "error", reason: result.reason };
}

/**
 * POST /api/v1/claim/verify-endpoint — Ed25519 signed-nonce round-trip.
 *
 * The handler mints a fresh nonce, hands it to the adapter (which POSTs
 * to the caller-supplied endpoint and verifies the JWS comes back signed
 * by the claim's `ed25519_public_key_hex`), and transitions tier2_pending
 * → tier2_verified on `match`. Mismatches discriminate signature failures
 * (tampering / wrong key) from nonce-mismatch (replay) so an operator
 * dashboard can see them apart.
 */
export async function claimVerifyEndpoint(
  input: ClaimVerifyEndpointInput,
  deps: ClaimDeps,
): Promise<ClaimVerifyEndpointResult> {
  const claim = await deps.claimRepo.findById(input.claimId);
  if (!claim) return { ok: false, status: "not-found-claim" };
  if (claim.assetType !== "domain") {
    return { ok: false, status: "wrong-asset-type", assetType: claim.assetType };
  }
  if (claim.state !== "tier2_pending") {
    return { ok: false, status: "bad-state", currentState: claim.state };
  }

  // Fresh nonce per round-trip. 32 random bytes hex-encoded — same
  // shape as the verification_code but a separate value so a stale
  // verification_code can't be replayed against the endpoint.
  const nonce = mintNonceHex();

  const result = await deps.endpoint.verifyEndpointSignedNonce(
    input.endpointUrl,
    nonce,
    claim.ed25519PublicKeyHex,
  );

  if (result.status === "match") {
    await deps.claimRepo.markTier2Verified(claim.id);
    return { ok: true, tier: 2 };
  }
  if (result.status === "signature-invalid") {
    return { ok: false, status: "signature-invalid", reason: result.reason };
  }
  if (result.status === "nonce-mismatch") {
    return { ok: false, status: "nonce-mismatch", sent: result.sent, received: result.received };
  }
  // result.status === "error"
  return result.detail !== undefined
    ? { ok: false, status: "error", reason: result.reason, detail: result.detail }
    : { ok: false, status: "error", reason: result.reason };
}

/** 32 random bytes -> 64-char lowercase hex. Same primitive shape we use
 *  for ed25519_public_key_hex; cryptographically random per round trip. */
function mintNonceHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i]?.toString(16).padStart(2, "0");
  return s;
}
