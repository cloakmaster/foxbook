// Claim-flow primitives. Three functions matching the apps/api claim
// flow contract:
//
//   claimStart        — POST /api/v1/claim/start, mints did + verification code
//   claimVerifyGist   — POST /api/v1/claim/verify-gist, transitions to tier1
//   claimRevoke       — POST /api/v1/claim/revoke, recovery-key-signed revocation
//
// All three return discriminated unions keyed on `status`. Network /
// non-JSON / unexpected status-code paths fold into `{status: "error"}`
// so callers always get a typed result back rather than an exception.
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

/** Default API base. The Fly.io-deployed reference at api.foxbook.dev.
 *  Routes prepend their own `/api/v1` prefix, so this base is the bare
 *  hostname. Callers can override per-call via the `apiBase` option. */
export const DEFAULT_API_BASE = "https://api.foxbook.dev";

/** Internal: build the claim-route URL. Trim a trailing slash on the
 *  base so callers passing `https://api.foxbook.dev/` still work. */
function claimUrl(apiBase: string | undefined, verb: string): string {
  const base = (apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "");
  return `${base}/api/v1/claim/${verb}`;
}

/** Internal: POST + parse JSON, returning `{response, body}` or an
 *  error result if the network or JSON parse fails. */
async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: true; response: Response; body: unknown } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (e) {
    return {
      ok: false,
      reason: `non-JSON response (HTTP ${response.status}): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return { ok: true, response, body: parsed };
}

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

export type ClaimStartResult =
  | {
      status: "ok";
      claim_id: string;
      agent_did: FoxbookDid;
      verification_code: VerificationCode;
    }
  | { status: "asset-conflict" }
  | { status: "error"; reason: string };

/**
 * POST /api/v1/claim/start. Mints a fresh did + verification_code.
 * The caller publishes the verification_code (Gist / TXT / endpoint)
 * and then calls the matching verify function.
 *
 * @returns
 *  - `{status: "ok", ...}` on 201 success.
 *  - `{status: "asset-conflict"}` on 409 — another claim already
 *    holds (asset_type, asset_value).
 *  - `{status: "error", reason}` on network / non-JSON / unexpected
 *    HTTP code.
 */
export async function claimStart(input: ClaimStartInput): Promise<ClaimStartResult> {
  const requestBody: Record<string, unknown> = {
    asset_type: input.asset_type,
    asset_value: input.asset_value,
    ed25519_public_key_hex: input.ed25519_public_key_hex,
    recovery_key_fingerprint: input.recovery_key_fingerprint,
  };
  if (input.agent_did !== undefined) {
    requestBody.agent_did = input.agent_did;
  }

  const result = await postJson(claimUrl(input.apiBase, "start"), requestBody);
  if (!result.ok) return { status: "error", reason: result.reason };
  const { response, body } = result;

  if (response.status === 201) {
    const b = body as Record<string, unknown>;
    if (
      typeof b.claim_id === "string" &&
      typeof b.agent_did === "string" &&
      typeof b.verification_code === "string"
    ) {
      return {
        status: "ok",
        claim_id: b.claim_id,
        agent_did: b.agent_did as FoxbookDid,
        verification_code: b.verification_code,
      };
    }
    return { status: "error", reason: "201 response missing required fields" };
  }
  if (response.status === 409) {
    return { status: "asset-conflict" };
  }
  return {
    status: "error",
    reason: `unexpected HTTP ${response.status}`,
  };
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
  | { status: "identity-mismatch"; reason?: string }
  | { status: "still-pending"; reason?: string }
  | { status: "not-found"; reason?: string }
  | { status: "error"; reason: string };

/**
 * POST /api/v1/claim/verify-gist. Discriminated union mirrors the
 * server's claim/verify-gist handler statuses:
 *
 *  - `tier1-verified` — Gist matched + leaf appended; success.
 *  - `still-pending` — Gist fetched but verification_code not yet
 *    present; caller polls with backoff.
 *  - `identity-mismatch` — Gist owner differs from claim asset_value.
 *  - `not-found` — claim_id unknown OR Gist URL unreachable.
 *  - `error` — bad-request / wrong-asset-type / network / non-JSON.
 */
export async function claimVerifyGist(input: ClaimVerifyGistInput): Promise<ClaimVerifyGistResult> {
  const result = await postJson(claimUrl(input.apiBase, "verify-gist"), {
    claim_id: input.claim_id,
    gist_url: input.gist_url,
  });
  if (!result.ok) return { status: "error", reason: result.reason };
  const { response, body } = result;
  const b = body as Record<string, unknown>;

  // 200 + tier=1 success branch.
  if (response.status === 200 && b.tier === 1) {
    if (typeof b.leaf_index === "number" && typeof b.sth_jws === "string") {
      // The server doesn't currently return inclusion_proof_url
      // directly; we synthesise it from the worker base. Keep this
      // computation in claim.ts so verify.ts can be independent.
      const inclusionProofUrl = `https://transparency.foxbook.dev/inclusion/${b.leaf_index}`;
      return {
        status: "tier1-verified",
        leaf_index: b.leaf_index,
        sth_jws: b.sth_jws,
        inclusion_proof_url: inclusionProofUrl,
      };
    }
    return { status: "error", reason: "200 tier1 response missing required fields" };
  }

  const reason = typeof b.reason === "string" ? b.reason : undefined;

  // 200 + status field — server's "transient" branches.
  if (response.status === 200 && typeof b.status === "string") {
    if (b.status === "still-pending")
      return reason ? { status: "still-pending", reason } : { status: "still-pending" };
    if (b.status === "not-found")
      return reason ? { status: "not-found", reason } : { status: "not-found" };
    if (b.status === "error")
      return { status: "error", reason: reason ?? "server returned status:error" };
  }

  // 404 not-found-claim → fold into not-found.
  if (response.status === 404) return { status: "not-found", reason: "claim not found" };

  // 409 identity-mismatch.
  if (response.status === 409 && b.status === "identity-mismatch") {
    return reason ? { status: "identity-mismatch", reason } : { status: "identity-mismatch" };
  }

  // 400 bad-request / wrong-asset-type.
  if (response.status === 400) {
    const status = typeof b.status === "string" ? b.status : "bad-request";
    return { status: "error", reason: reason ?? status };
  }

  return { status: "error", reason: `unexpected HTTP ${response.status}` };
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
  | { status: "signature-invalid"; reason?: string }
  | { status: "not-found" }
  | { status: "error"; reason: string };

/**
 * POST /api/v1/claim/revoke. The recovery_key_signature MUST be a
 * compact JWS over canonical bytes (ADR 0005); the server re-binds
 * payload.did + payload.revoked_key_hex against the claim row before
 * accepting the revocation.
 *
 * @returns
 *  - `revoked` — server appended the revocation leaf; claim row deleted.
 *  - `signature-invalid` — recovery-key fingerprint or signature failed.
 *  - `not-found` — claim_id unknown.
 *  - `error` — bad-state / invalid-leaf / network / non-JSON.
 */
export async function claimRevoke(input: ClaimRevokeInput): Promise<ClaimRevokeResult> {
  // Server route reads `revocation_record_jws`. SDK exposes the more
  // user-friendly `recovery_key_signature` to consumers; we map at the
  // wire boundary.
  const result = await postJson(claimUrl(input.apiBase, "revoke"), {
    claim_id: input.claim_id,
    revocation_record_jws: input.recovery_key_signature,
  });
  if (!result.ok) return { status: "error", reason: result.reason };
  const { response, body } = result;
  const b = body as Record<string, unknown>;

  if (response.status === 200 && b.revoked === true) {
    if (typeof b.leaf_index === "number" && typeof b.sth_jws === "string") {
      return {
        status: "revoked",
        revocation_leaf_index: b.leaf_index,
        sth_jws: b.sth_jws,
      };
    }
    return { status: "error", reason: "200 revoked response missing required fields" };
  }
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 403) {
    // Both recovery-key-mismatch and recovery-key-signature-invalid
    // map here. Both indicate the caller's signing material doesn't
    // match what the server expects.
    const reason =
      typeof b.reason === "string" ? b.reason : typeof b.status === "string" ? b.status : undefined;
    return reason ? { status: "signature-invalid", reason } : { status: "signature-invalid" };
  }
  // 400 bad-state, 422 invalid-leaf → error.
  return {
    status: "error",
    reason: typeof b.reason === "string" ? b.reason : `unexpected HTTP ${response.status}`,
  };
}
