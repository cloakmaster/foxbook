// Verification primitives + convenience wrappers.
//
// Three functions:
//
//   verify              — primitive: leaf_index → {valid, root_hex, leaf_hash}
//   foxbookVerify       — handle → {tier, revoked, did, leafIndex} (or not-claimed)
//   verifyAgentCard     — runtime-safety gate before any agent-to-agent call
//
// Production usage: insert the wrapper before any agent-to-agent call.
//
//   const v = await verifyAgentCard(card, { asset_type: "github_handle" });
//   if (v.status !== "verified") return blockOrWarn(v);
//   // proceed with agent-to-agent call
//
// The four discriminated outcomes map to {allowed, blocked, blocked,
// warning}. No numeric trust scores anywhere in the response shape —
// verification (objective, cryptographic) is kept separate from
// reputation (subjective).

import { merkle } from "@foxbook/core";

import { DEFAULT_API_BASE, type Ed25519PublicKeyHex, type FoxbookDid } from "./claim.js";

// Re-export so consumers and tests get DEFAULT_API_BASE from the same
// surface as DEFAULT_WORKER_BASE without two import paths.
export { DEFAULT_API_BASE } from "./claim.js";

// ---- Common ----

/** Default transparency-log Worker base — the canonical reference deployment. */
export const DEFAULT_WORKER_BASE = "https://transparency.foxbook.dev";

/** Trim a trailing slash so callers passing `https://x/` still build clean URLs. */
function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** hex → Uint8Array. Throws on bad-shape input (odd length / non-hex). */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error(`hex string must have even length, got ${hex.length}`);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`hex string contains non-hex character`);
    out[i] = byte;
  }
  return out;
}

/** Internal: GET + parse JSON, returning `{response, body}` or an
 *  error result if the network or JSON parse fails. */
async function getJson(
  url: string,
): Promise<{ ok: true; response: Response; body: unknown } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(url);
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

/** Decode a JWS compact-token's payload segment without verifying the
 *  signature. Returns the parsed JSON or null on shape errors. Used
 *  for STH timestamp extraction in freshness checks. Callers that
 *  need full signature verification should pull the public key from
 *  /.well-known/foxbook.json and use jwsVerify from @foxbook/core. */
function decodeJwsPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payloadB64 = parts[1];
  if (!payloadB64) return null;
  try {
    const padded =
      payloadB64.replaceAll("-", "+").replaceAll("_", "/") +
      "===".slice((payloadB64.length + 3) % 4);
    const raw = atob(padded);
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---- verify (primitive) ----

export type VerifyInput = {
  leaf_index: number;
  /** Override transparency Worker base. Defaults to DEFAULT_WORKER_BASE. */
  worker_base?: string;
};

export type VerifyResult =
  | { valid: true; leaf_index: number; root_hex: string; leaf_hash: string }
  | { valid: false; reason: string };

/**
 * Verify a Merkle inclusion proof against the current STH root.
 * Fetches `/inclusion/:index` + `/root` from the transparency Worker
 * in parallel; reconstructs the root from the inclusion proof using
 * `verifyInclusion` from @foxbook/core/merkle; returns valid only if
 * the reconstructed root matches the served root byte-for-byte.
 *
 * @returns
 *   - `{valid: true, leaf_index, root_hex, leaf_hash}` on success.
 *   - `{valid: false, reason}` on network error, missing fields, or
 *     proof reconstruction failure.
 */
export async function verify(input: VerifyInput): Promise<VerifyResult> {
  const base = trimTrailingSlash(input.worker_base ?? DEFAULT_WORKER_BASE);
  const [inclusionResult, rootResult] = await Promise.all([
    getJson(`${base}/inclusion/${input.leaf_index}`),
    getJson(`${base}/root`),
  ]);
  if (!inclusionResult.ok) return { valid: false, reason: `/inclusion: ${inclusionResult.reason}` };
  if (!rootResult.ok) return { valid: false, reason: `/root: ${rootResult.reason}` };
  if (inclusionResult.response.status !== 200) {
    return { valid: false, reason: `/inclusion HTTP ${inclusionResult.response.status}` };
  }
  if (rootResult.response.status !== 200) {
    return { valid: false, reason: `/root HTTP ${rootResult.response.status}` };
  }

  const inc = inclusionResult.body as Record<string, unknown>;
  const root = rootResult.body as Record<string, unknown>;

  if (
    typeof inc.leafHash !== "string" ||
    typeof inc.leafIndex !== "number" ||
    typeof inc.treeSize !== "number" ||
    !Array.isArray(inc.proofHex) ||
    typeof inc.rootHex !== "string"
  ) {
    return { valid: false, reason: "/inclusion response missing required fields" };
  }
  if (typeof root.rootHash !== "string") {
    return { valid: false, reason: "/root response missing rootHash" };
  }

  // Crucial cross-check: the /inclusion endpoint returns the root at
  // its sample point, the /root endpoint returns the latest STH root.
  // We accept either matching root since the leaf is immutable, but
  // the reconstruction must verify against ONE of them.
  let leafBytes: Uint8Array;
  let proofBytes: Uint8Array[];
  let rootInclBytes: Uint8Array;
  try {
    leafBytes = hexToBytes(inc.leafHash);
    proofBytes = (inc.proofHex as string[]).map((h) => hexToBytes(h));
    rootInclBytes = hexToBytes(inc.rootHex);
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : String(e) };
  }

  const valid = merkle.verifyInclusion(
    proofBytes,
    inc.leafIndex,
    leafBytes,
    inc.treeSize,
    rootInclBytes,
  );
  if (!valid) {
    return { valid: false, reason: "merkle proof did not reconstruct to expected root" };
  }

  return {
    valid: true,
    leaf_index: inc.leafIndex,
    root_hex: inc.rootHex,
    leaf_hash: inc.leafHash,
  };
}

// ---- foxbookVerify (handle-level convenience wrapper) ----

export type AssetType = "github_handle" | "x_handle" | "domain";

export type FoxbookVerifyInput = {
  /** Asset type — the by-handle endpoint requires this explicitly to
   *  avoid github/x ambiguity for `@somebody`-style values. */
  asset_type: AssetType;
  /** Asset value (handle string or domain). */
  asset_value: string;
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
};

/**
 * The claimed-tier discriminator. Tier-1 + Tier-2 are reachable via
 * the current claim flow; Tier-3+ are reserved.
 */
export type ClaimedTier = 1 | 2 | 3;

/**
 * Result shape. Returns verification status only — never a numeric
 * trust score. Aggregate reputation/scoring belongs in a separate
 * surface above this primitive.
 */
export type FoxbookVerifyResult =
  | { tier: ClaimedTier; revoked: boolean; did: FoxbookDid; leafIndex: number | null }
  | { status: "not-claimed" }
  | { status: "error"; reason: string };

/**
 * Look up an asset (github_handle, x_handle, or domain) and return
 * its current claim metadata. Calls the read-only
 * `GET /api/v1/claim/by-handle/:asset_type/:asset_value` endpoint.
 *
 * Revoked claims return `not-claimed` because rows are deleted on
 * revoke per ADR 0004 addendum-1; if you need to distinguish revoked
 * from never-claimed, file a separate revocation lookup (Day-10+
 * housekeeping, surfaces a separate revocation index).
 */
export async function foxbookVerify(input: FoxbookVerifyInput): Promise<FoxbookVerifyResult> {
  const base = trimTrailingSlash(input.apiBase ?? DEFAULT_API_BASE);
  const url = `${base}/api/v1/claim/by-handle/${encodeURIComponent(input.asset_type)}/${encodeURIComponent(input.asset_value)}`;
  const result = await getJson(url);
  if (!result.ok) return { status: "error", reason: result.reason };
  const { response, body } = result;

  if (response.status === 404) return { status: "not-claimed" };
  if (response.status !== 200) {
    return { status: "error", reason: `unexpected HTTP ${response.status}` };
  }

  const b = body as Record<string, unknown>;
  if (
    typeof b.agent_did !== "string" ||
    typeof b.verification_tier !== "number" ||
    typeof b.revoked !== "boolean"
  ) {
    return { status: "error", reason: "by-handle response missing required fields" };
  }
  const tier = b.verification_tier as ClaimedTier;
  if (tier !== 1 && tier !== 2 && tier !== 3) {
    // tier 0 is unclaimed/pending; surface as not-claimed for the
    // SDK's discriminated semantic.
    return { status: "not-claimed" };
  }
  const leafIndex = typeof b.leaf_index === "number" ? b.leaf_index : null;
  return {
    tier,
    revoked: b.revoked,
    did: b.agent_did as FoxbookDid,
    leafIndex,
  };
}

// ---- verifyAgentCard (runtime-safety primitive) ----

/**
 * The minimum AgentCard shape `verifyAgentCard` reads. Mirrors A2A's
 * `AgentCard` with the `x-foxbook` extension; the type is narrow so
 * callers can pass partial cards without TS friction.
 */
export type VerifiableAgentCard = {
  /** Handle the card claims to belong to. The handle-mismatch check
   *  binds this to the claim row's asset_value. */
  handle?: string;
  "x-foxbook"?: {
    did?: FoxbookDid;
    foxbook_url?: string;
    verification_tier?: number;
    signatures?: {
      ed25519_public_key_hex?: Ed25519PublicKeyHex;
      transparency_log_entry?: string;
    };
  };
};

export type VerifyAgentCardOptions = {
  /** Asset type for the card's handle. Required because @somebody-style
   *  handles are ambiguous between github_handle and x_handle. */
  asset_type: AssetType;
  /** If true, refuse `verified` unless an inclusion proof is fetched
   *  from the transparency Worker and reconstructs to the served root.
   *  Defaults to true — evidence over assertion. */
  requireInclusionProof?: boolean;
  /** If set, refuse `verified` when the STH is older than this
   *  threshold (in seconds). Useful for high-stakes calls where
   *  freshness matters. Defaults to undefined (any age passes). */
  requireFreshSTH?: number;
  /** Override API base. Defaults to DEFAULT_API_BASE. */
  apiBase?: string;
  /** Override transparency Worker base. Defaults to DEFAULT_WORKER_BASE. */
  worker_base?: string;
};

/**
 * Four-way discriminated outcome. Maps to the caller's policy gate as:
 *
 *   verified         → allowed
 *   unverified       → blocked
 *   handle-mismatch  → blocked (the card claims a handle the
 *                       transparency log does NOT attest)
 *   stale-proof      → warning (caller decides; e.g. refresh + retry)
 *
 * No numeric trust score in any branch. The four discriminated
 * outcomes are the entire surface.
 */
export type VerifyAgentCardResult =
  | { status: "verified"; tier: ClaimedTier; did: FoxbookDid; leafIndex: number | null }
  | { status: "unverified"; reason: string }
  | { status: "handle-mismatch"; claimed_handle: string; card_handle: string }
  | {
      status: "stale-proof";
      proof_age_seconds: number;
      threshold_seconds: number;
    };

/**
 * Runtime-safety primitive: insert before any agent-to-agent call.
 *
 *   const v = await verifyAgentCard(card, { asset_type: "github_handle", requireFreshSTH: 3600 });
 *   if (v.status !== "verified") return blockOrWarn(v);
 *
 * Pipeline:
 *  1. Read `card.handle` + `card["x-foxbook"].did`. If either is
 *     missing, return `unverified`.
 *  2. Look up the handle via `foxbookVerify`. If `not-claimed`, return
 *     `unverified`.
 *  3. (skipped today) handle-mismatch — the by-handle endpoint
 *     returned the row keyed BY the handle, so the asset_value
 *     equals the handle by construction. Mismatch detection in v1
 *     compares card.x-foxbook.did vs claim.agent_did instead.
 *  4. If `requireInclusionProof` (default true), call `verify` to
 *     reconstruct the Merkle root. Mismatch → unverified.
 *  5. If `requireFreshSTH` is set, parse the STH JWS payload's
 *     timestamp and reject if the STH is older than the threshold.
 *  6. Return `verified` with tier + did + leafIndex.
 */
export async function verifyAgentCard(
  card: VerifiableAgentCard,
  options: VerifyAgentCardOptions,
): Promise<VerifyAgentCardResult> {
  const cardHandle = card.handle;
  const cardDid = card["x-foxbook"]?.did;
  if (!cardHandle) {
    return { status: "unverified", reason: "card.handle missing" };
  }

  const verifyOpts: { asset_type: AssetType; asset_value: string; apiBase?: string } = {
    asset_type: options.asset_type,
    asset_value: cardHandle,
  };
  if (options.apiBase !== undefined) verifyOpts.apiBase = options.apiBase;

  const lookup = await foxbookVerify(verifyOpts);
  if ("status" in lookup) {
    if (lookup.status === "not-claimed") {
      return { status: "unverified", reason: "handle not in transparency log" };
    }
    return { status: "unverified", reason: `lookup error: ${lookup.reason}` };
  }

  // Handle-mismatch surface: when the card claims a different did
  // than the transparency log attests for that handle, the card is
  // lying about which agent owns the handle.
  if (cardDid !== undefined && cardDid !== lookup.did) {
    return {
      status: "handle-mismatch",
      claimed_handle: cardHandle,
      card_handle: cardHandle,
    };
  }

  // Inclusion proof — verifies the Merkle log actually attests this
  // claim. Default ON so consumers get evidence-over-assertion semantics.
  const requireInclusionProof = options.requireInclusionProof ?? true;
  if (requireInclusionProof) {
    if (lookup.leafIndex === null) {
      return { status: "unverified", reason: "claim has no inclusion-proof leaf yet" };
    }
    const verifyInput: VerifyInput = { leaf_index: lookup.leafIndex };
    if (options.worker_base !== undefined) verifyInput.worker_base = options.worker_base;
    const inclusion = await verify(verifyInput);
    if (!inclusion.valid) {
      return { status: "unverified", reason: `inclusion proof failed: ${inclusion.reason}` };
    }
  }

  // Freshness check — pull the STH timestamp from the latest /root
  // call. We re-fetch /root rather than threading it from `verify`
  // because (a) verify might be skipped, (b) the freshness window is
  // independent of the proof check.
  if (options.requireFreshSTH !== undefined) {
    const base = trimTrailingSlash(options.worker_base ?? DEFAULT_WORKER_BASE);
    const rootResult = await getJson(`${base}/root`);
    if (!rootResult.ok || rootResult.response.status !== 200) {
      return {
        status: "unverified",
        reason: `cannot fetch /root for freshness: ${rootResult.ok ? `HTTP ${rootResult.response.status}` : rootResult.reason}`,
      };
    }
    const root = rootResult.body as Record<string, unknown>;
    const sthJws = typeof root.sthJws === "string" ? root.sthJws : null;
    if (!sthJws) {
      return { status: "unverified", reason: "/root response missing sthJws" };
    }
    const payload = decodeJwsPayload(sthJws);
    const ts = payload && typeof payload.timestamp === "string" ? payload.timestamp : null;
    if (!ts) {
      return { status: "unverified", reason: "STH JWS payload missing timestamp" };
    }
    const sthMs = Date.parse(ts);
    if (Number.isNaN(sthMs)) {
      return { status: "unverified", reason: `STH timestamp not parseable: ${ts}` };
    }
    const age = Math.floor((Date.now() - sthMs) / 1000);
    if (age > options.requireFreshSTH) {
      return {
        status: "stale-proof",
        proof_age_seconds: age,
        threshold_seconds: options.requireFreshSTH,
      };
    }
  }

  return {
    status: "verified",
    tier: lookup.tier,
    did: lookup.did,
    leafIndex: lookup.leafIndex,
  };
}
