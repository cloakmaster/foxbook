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
