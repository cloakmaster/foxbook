// Claim-flow types. The repository + gist-verifier interfaces are
// defined here so tests can inject fakes and handlers can stay pure.

import type { GistVerifyResult } from "@foxbook/adapter-gist";
import type { MerkleAppendResult, MerkleRepository } from "@foxbook/db";

export type AssetType = "github_handle" | "x_handle" | "domain";

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

export type { MerkleAppendResult };
