// Claim-flow primitives. Three functions matching the apps/api claim
// flow contract:
//
//   claimStart        — POST /api/v1/claim/start, mints did + verification code
//   claimVerifyGist   — POST /api/v1/claim/verify-gist, transitions to tier1
//   claimRevoke       — POST /api/v1/claim/revoke, recovery-key-signed revocation
//
// Day-7 PR E: signatures + discriminated-union types only. Bodies
// throw "not implemented"; the implementation lands in week 2 per
// PROJECT-PLAN.md Distribution Track. The stable signatures committed
// today are what the RFC, outreach DMs, and docs/distribution.md all
// reference as the contract — they MUST NOT shift in week 2.
//
// ADR cross-refs:
//   * ADR 0001 — service-agnostic core. This package lives in
//     packages/, ban list applies. No adapter imports, no banned
//     capability literals, no provider names.

// ---- Common ----

/** Agent did namespace. Mirrors core/src/did.ts pattern: did:foxbook:{ULID}. */
export type FoxbookDid = `did:foxbook:${string}`;

/** SHA-256 fingerprint of recovery-key public bytes. */
export type RecoveryKeyFingerprint = `sha256:${string}`;

/** 64-char lowercase hex Ed25519 public key. */
export type Ed25519PublicKeyHex = string;

/** Verification code minted at claim/start; appears in the Gist /
 *  TXT / email / tweet, depending on tier path. */
export type VerificationCode = string;

/** Default API base. The reference deployment is foxbook.dev/api/v1;
 *  callers can override per-call via the apiBase option. */
export const DEFAULT_API_BASE = "https://foxbook.dev/api/v1";

// ---- claimStart ----

export type ClaimStartInput = {
  asset_type: "github_handle" | "x_handle" | "domain";
  asset_value: string;
  ed25519_public_key_hex: Ed25519PublicKeyHex;
  recovery_key_fingerprint: RecoveryKeyFingerprint;
  /** Optional: pin the did. Server mints a fresh ULID-did when absent. */
  agent_did?: FoxbookDid;
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
};

export type ClaimStartResult = {
  claim_id: string;
  agent_did: FoxbookDid;
  verification_code: VerificationCode;
};

/**
 * POST /api/v1/claim/start. Returns the freshly-minted claim_id and
 * verification_code. The caller publishes the code (Gist, TXT record,
 * tweet, etc.) and then calls the matching verify function.
 *
 * @throws Error("not implemented") — Day-7 PR E ships signatures only.
 *         Week-2 implementation: fetch JSON-shaped POST + 201 →
 *         envelope parse + asset-conflict (409) → throw with
 *         discriminated error code.
 */
export async function claimStart(_input: ClaimStartInput): Promise<ClaimStartResult> {
  throw new Error("@foxbook/sdk-claim: claimStart not implemented (week-2 Distribution Track)");
}

// ---- claimVerifyGist ----

export type ClaimVerifyGistInput = {
  claim_id: string;
  gist_url: string;
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
};

export type ClaimVerifyGistResult =
  | {
      status: "tier1-verified";
      leaf_index: number;
      sth_jws: string;
      inclusion_proof_url: string;
    }
  | { status: "identity-mismatch"; reason: string }
  | { status: "still-pending" }
  | { status: "not-found" }
  | { status: "error"; reason: string };

/**
 * POST /api/v1/claim/verify-gist. Discriminated union mirrors the
 * server-side handler statuses 1:1 — `still-pending` is the retry
 * signal (caller polls with backoff), `identity-mismatch` is a hard
 * reject (the Gist owner doesn't match the claim's asset_value).
 *
 * @throws Error("not implemented") — Day-7 PR E ships signatures only.
 */
export async function claimVerifyGist(
  _input: ClaimVerifyGistInput,
): Promise<ClaimVerifyGistResult> {
  throw new Error(
    "@foxbook/sdk-claim: claimVerifyGist not implemented (week-2 Distribution Track)",
  );
}

// ---- claimRevoke ----

export type ClaimRevokeInput = {
  claim_id: string;
  /** Compact-JWS string signed by the recovery key. The header must
   *  carry an Ed25519 jwk; the payload is the canonical revocation
   *  leaf body (sans recovery_key_signature). */
  recovery_key_signature: string;
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
};

export type ClaimRevokeResult =
  | { status: "revoked"; revocation_leaf_index: number; sth_jws: string }
  | { status: "signature-invalid"; reason: string }
  | { status: "not-found" }
  | { status: "error"; reason: string };

/**
 * POST /api/v1/claim/revoke. The recovery_key_signature MUST be a
 * compact JWS over canonical bytes (ADR 0005); the server re-binds
 * payload.did + payload.revoked_key_hex against the claim row before
 * accepting the revocation.
 *
 * @throws Error("not implemented") — Day-7 PR E ships signatures only.
 */
export async function claimRevoke(_input: ClaimRevokeInput): Promise<ClaimRevokeResult> {
  throw new Error("@foxbook/sdk-claim: claimRevoke not implemented (week-2 Distribution Track)");
}
