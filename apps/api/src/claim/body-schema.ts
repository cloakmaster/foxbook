import { z } from "zod";

const didPattern = /^did:foxbook:[0-9A-HJKMNP-TV-Z]{26}$/;
const hex64Pattern = /^[0-9a-f]{64}$/;
const sha256HexPattern = /^sha256:[0-9a-f]{64}$/;

export const claimStartBodySchema = z.object({
  asset_type: z.enum(["github_handle", "x_handle", "domain"]),
  asset_value: z.string().min(1).max(100),
  ed25519_public_key_hex: z.string().regex(hex64Pattern),
  recovery_key_fingerprint: z.string().regex(sha256HexPattern),
  agent_did: z.string().regex(didPattern).optional(),
});
export type ClaimStartBody = z.infer<typeof claimStartBodySchema>;

export const claimVerifyGistBodySchema = z.object({
  claim_id: z.string().uuid(),
  gist_url: z.string().url(),
});
export type ClaimVerifyGistBody = z.infer<typeof claimVerifyGistBodySchema>;

// Day-6 PR B — POST /api/v1/claim/revoke.
// The JWS-compact pattern matches one of three segments separated by `.`,
// each base64url. We keep the regex minimal here (length>0, three segments,
// base64url alphabet) — full structural verification (alg, jwk, signature)
// happens in the handler against @foxbook/core's jwsVerify, where the
// failure modes can be discriminated and surfaced as proper HTTP statuses.
const compactJwsPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const claimRevokeBodySchema = z.object({
  claim_id: z.string().uuid(),
  revocation_record_jws: z.string().regex(compactJwsPattern),
});
export type ClaimRevokeBody = z.infer<typeof claimRevokeBodySchema>;
