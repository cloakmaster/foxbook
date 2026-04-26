// Claim-flow types. The repository + gist-verifier interfaces are
// defined here so tests can inject fakes and handlers can stay pure.

import type { GistVerifyResult } from "@foxbook/adapter-gist";
import type { MerkleAppendResult, MerkleRepository } from "@foxbook/db";

export type AssetType = "github_handle" | "x_handle" | "domain";

// claim_state values that come back from the DB. Day-6 PR B keeps the
// enum unchanged: delete-on-revoke per ADR 0004 addendum-1 means a
// revoked claim row is physically gone, so a "revoked" enum value
// would be dead schema. Soft-revoke (if it ever becomes a real
// product requirement) adds the value via a forward-only migration
// at that time.
export type ClaimState =
  | "unclaimed"
  | "gist_pending"
  | "tier1_verified"
  | "tier2_pending"
  | "tier2_verified";

export type ClaimRow = {
  id: string;
  agentDid: string;
  state: ClaimState;
  assetType: AssetType;
  assetValue: string;
  ed25519PublicKeyHex: string;
  recoveryKeyFingerprint: string;
  verificationCode: string;
  startedAt: Date;
  completedAt: Date | null;
};

export type ClaimStartInput = {
  assetType: AssetType;
  assetValue: string;
  ed25519PublicKeyHex: string;
  recoveryKeyFingerprint: string;
  agentDid?: string;
};

export type ClaimStartResult =
  | { ok: true; claim: ClaimRow }
  | { ok: false; status: "asset-conflict" };

export type ClaimVerifyGistInput = {
  claimId: string;
  gistUrl: string;
};

export type ClaimVerifyGistResult =
  | {
      ok: true;
      tier: 1;
      leafIndex: number;
      leafHash: string;
      rootAfter: string;
      sthJws: string;
    }
  | { ok: false; status: "not-found"; reason?: string }
  | { ok: false; status: "still-pending"; reason?: string }
  | { ok: false; status: "identity-mismatch"; reason?: string }
  | { ok: false; status: "error"; reason?: string }
  | { ok: false; status: "bad-request"; reason: string }
  | { ok: false; status: "not-found-claim" }
  | { ok: false; status: "wrong-asset-type"; assetType: AssetType };

/**
 * Repository seam the handlers talk to. Backed by Drizzle in
 * production (repository.ts) and by an in-memory fake in tests —
 * same pattern the discover handlers use.
 */
export type ClaimRepository = {
  insertClaim: (
    row: Omit<ClaimRow, "id" | "startedAt" | "completedAt">,
  ) => Promise<{ ok: true; id: string } | { ok: false; status: "asset-conflict" }>;
  findById: (id: string) => Promise<ClaimRow | null>;
  markTier1Verified: (id: string) => Promise<void>;
  insertSigningKey: (agentDid: string, publicKeyHex: string) => Promise<void>;
};

/** Narrow slice of gist adapter — lets tests swap in a deterministic verifier. */
export type GistVerifier = {
  verifyGistContainsCode: (
    gistUrl: string,
    code: string,
    expectedOwner: string,
  ) => Promise<GistVerifyResult>;
};

/** The write-side Merkle surface the claim flow needs. */
export type MerkleAppender = Pick<MerkleRepository, "append">;

// ---- Revocation (Day-6 PR B) ----

/**
 * Allowed revocation reason codes per schemas/tl-leaf.v1.json#/$defs/revocation.
 * Additive within v1.x per ADR 0003 + ADR 0004; new values land via JSON-schema
 * bump, never via code-side enum constants.
 */
export type RevocationReasonCode = "key_compromise" | "owner_request" | "superseded";

/** Input shape for POST /api/v1/claim/revoke. */
export type ClaimRevokeInput = {
  claimId: string;
  /** Compact-JWS string. Header MUST carry an EdDSA `jwk` for the recovery
   * public key. Payload is the canonical revocation leaf body sans
   * `recovery_key_signature` (the signature can't sign itself). */
  revocationRecordJws: string;
};

export type ClaimRevokeResult =
  | {
      ok: true;
      revoked: true;
      leafIndex: number;
      leafHash: string;
      sthJws: string;
    }
  | { ok: false; status: "not-found-claim" }
  | { ok: false; status: "bad-state"; currentState: ClaimState }
  | { ok: false; status: "recovery-key-mismatch"; reason?: string }
  | { ok: false; status: "recovery-key-signature-invalid"; reason: string }
  | { ok: false; status: "invalid-leaf"; reason: string };

/**
 * Atomic-tx surface for revocation. Production wiring (revocation-committer.ts)
 * runs `db.transaction(async (tx) => {merkle.append(leaf, {tx}); tx.insert(firehoseEvents); tx.delete(claims);})`.
 * Tests inject a fake that records the call + returns a stubbed result.
 *
 * Encapsulating the whole tx behind one deps function keeps the handler
 * testable without mocking Drizzle's transaction surface, AND keeps the
 * tx body in one production file (revocation-committer.ts) where ADR
 * 0004 addendum-1 hygiene rules are auditable.
 */
export type RevocationCommitterInput = {
  /** The claim row whose row will be DELETEd as part of the tx. */
  claim: ClaimRow;
  /** The full revocation leaf — including `recovery_key_signature` —
   * canonicalized + hashed by merkle-repository at append time. */
  fullLeaf: unknown;
};

export type RevocationCommitter = (
  input: RevocationCommitterInput,
) => Promise<MerkleAppendResult>;

export type { MerkleAppendResult };
