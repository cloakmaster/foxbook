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

import { DEFAULT_API_BASE, type Ed25519PublicKeyHex, type FoxbookDid } from "./claim.js";
import { verifyInclusion } from "./merkle-internal.js";
import { verifySthJws } from "./sth-verify.js";

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

// ---- verify (primitive) ----

export type VerifyInput = {
  leaf_index: number;
  /** Override transparency Worker base. Defaults to DEFAULT_WORKER_BASE. */
  worker_base?: string;
  /** Override API base — used to fetch the log's signing public key from
   *  `{api_base}/.well-known/foxbook.json`. Defaults to DEFAULT_API_BASE. */
  api_base?: string;
};

export type VerifyResult =
  | { valid: true; leaf_index: number; root_hex: string; leaf_hash: string }
  | { valid: false; reason: string };

/**
 * Verify a Merkle inclusion proof against the log's SIGNED tree head.
 *
 * Security model (fail-closed): the proof is only as trustworthy as the
 * root it reconstructs to. The transparency Worker's `/inclusion`
 * endpoint returns an UNSIGNED, server-supplied `rootHex` — trusting it
 * lets a malicious or MITM'd server serve any leaf + a self-consistent
 * proof + a matching `rootHex` and pass. So instead we:
 *
 *  1. Fetch the log's Ed25519 signing public key from
 *     `{api_base}/.well-known/foxbook.json`. Absent → fail.
 *  2. Verify the STH JWS signature (`/root` → `sthJws`) against that
 *     key. Bad signature / wrong key / malformed → fail.
 *  3. Reconstruct the inclusion proof and require it to match the
 *     SIGNED `root_hash` from the verified STH — NOT `inc.rootHex`.
 *     We also pin `inc.treeSize` to the signed `tree_size`.
 *
 * `/inclusion`, `/root`, and `.well-known/foxbook.json` are fetched in
 * parallel.
 *
 * @returns
 *   - `{valid: true, leaf_index, root_hex, leaf_hash}` on success, where
 *     `root_hex` is the SIGNED root (verifiable, not server-asserted).
 *   - `{valid: false, reason}` on network error, missing key, bad STH
 *     signature, missing fields, or proof reconstruction failure.
 */
export async function verify(input: VerifyInput): Promise<VerifyResult> {
  const base = trimTrailingSlash(input.worker_base ?? DEFAULT_WORKER_BASE);
  const apiBase = trimTrailingSlash(input.api_base ?? DEFAULT_API_BASE);
  const [inclusionResult, rootResult, wellKnownResult] = await Promise.all([
    getJson(`${base}/inclusion/${input.leaf_index}`),
    getJson(`${base}/root`),
    getJson(`${apiBase}/.well-known/foxbook.json`),
  ]);
  if (!inclusionResult.ok) return { valid: false, reason: `/inclusion: ${inclusionResult.reason}` };
  if (!rootResult.ok) return { valid: false, reason: `/root: ${rootResult.reason}` };
  if (inclusionResult.response.status !== 200) {
    return { valid: false, reason: `/inclusion HTTP ${inclusionResult.response.status}` };
  }
  if (rootResult.response.status !== 200) {
    return { valid: false, reason: `/root HTTP ${rootResult.response.status}` };
  }

  // The log's signing public key is the trust anchor. No key → we
  // cannot verify the STH signature → fail closed (never fall back to
  // the unsigned server-supplied root).
  const publicKeyHex = extractLogPublicKey(wellKnownResult);
  if (publicKeyHex === null) {
    return {
      valid: false,
      reason: "log signing public key unavailable from /.well-known/foxbook.json",
    };
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
  if (typeof root.sthJws !== "string") {
    return { valid: false, reason: "/root response missing sthJws" };
  }

  // Verify the signed tree head. The verified payload carries the
  // SIGNED root_hash + tree_size — the only root we will trust the
  // proof to reconstruct against.
  const sth = await verifySthJws(root.sthJws, publicKeyHex);
  if (!sth.valid) {
    return { valid: false, reason: `STH signature verification failed: ${sth.reason}` };
  }

  // Pin the proof's tree size to the SIGNED tree size. A server that
  // serves a proof under a different tree size than the STH attests is
  // not proving inclusion in the head we just verified.
  if (inc.treeSize !== sth.payload.tree_size) {
    return {
      valid: false,
      reason: `/inclusion treeSize ${inc.treeSize} != signed STH tree_size ${sth.payload.tree_size}`,
    };
  }

  let leafBytes: Uint8Array;
  let proofBytes: Uint8Array[];
  let signedRootBytes: Uint8Array;
  try {
    leafBytes = hexToBytes(inc.leafHash);
    proofBytes = (inc.proofHex as string[]).map((h) => hexToBytes(h));
    // Reconstruct against the SIGNED root, NOT the server-supplied
    // inc.rootHex. This is the crux of the fix.
    signedRootBytes = hexToBytes(sth.payload.root_hash);
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : String(e) };
  }

  const valid = verifyInclusion(
    proofBytes,
    inc.leafIndex,
    leafBytes,
    inc.treeSize,
    signedRootBytes,
  );
  if (!valid) {
    return { valid: false, reason: "merkle proof did not reconstruct to signed STH root" };
  }

  return {
    valid: true,
    leaf_index: inc.leafIndex,
    root_hex: sth.payload.root_hash,
    leaf_hash: inc.leafHash,
  };
}

/**
 * Pull `log_signing_public_key_hex` out of a `/.well-known/foxbook.json`
 * fetch result. Returns null if the fetch failed, the HTTP status was
 * non-200, or the field is absent / not a string. The caller treats
 * null as a hard verification failure (fail closed).
 */
function extractLogPublicKey(
  result: { ok: true; response: Response; body: unknown } | { ok: false; reason: string },
): string | null {
  if (!result.ok || result.response.status !== 200) return null;
  const body = result.body as Record<string, unknown>;
  const key = body.log_signing_public_key_hex;
  return typeof key === "string" && key.length > 0 ? key : null;
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
 *
 * v0.2 — `verified_signing_key_hex` is the agent's currently-active
 * Ed25519 signing key (lowercase hex, 64 chars) sourced from the
 * latest agent-key-registration / signing-key-registration leaf for
 * this DID. Surfaced on the tier-bearing branch so an enforcement
 * gateway can verify an AgentCard's JWS signature without a second
 * lookup against the by-handle endpoint.
 */
export type FoxbookVerifyResult =
  | {
      tier: ClaimedTier;
      revoked: boolean;
      did: FoxbookDid;
      leafIndex: number | null;
      verified_signing_key_hex: Ed25519PublicKeyHex;
    }
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
    typeof b.revoked !== "boolean" ||
    typeof b.ed25519_public_key_hex !== "string"
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
    verified_signing_key_hex: b.ed25519_public_key_hex as Ed25519PublicKeyHex,
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
 * Structured discriminator on `unverified` outcomes. Lets callers
 * distinguish retry-decisionable failures (`key-not-yet-logged` —
 * the rotation leaf hasn't appended yet, retry shortly) from
 * hard-blocks (`handle-not-claimed`, `inclusion-proof-failed`,
 * `card-malformed`).
 *
 * `key-not-yet-logged` is reserved for the rotation transition
 * window once the rotation flow lands (tl-leaf.v1.json v1.2 +
 * ADR 0004 addendum-3): an AgentCard signed with a new key whose
 * signing-key-registration leaf has been written but isn't yet in
 * the latest STH. Callers SHOULD retry after a short delay rather
 * than permanent-block.
 *
 * Additive across SDK minor versions per ADR 0003 spirit — adding
 * new reason_code values is in-place v0.x; removing values would
 * require a major bump.
 */
export type VerifyUnverifiedReasonCode =
  | "handle-not-claimed"
  | "inclusion-proof-failed"
  | "key-not-yet-logged"
  | "card-malformed";

/**
 * Four-way discriminated outcome. Maps to the caller's policy gate as:
 *
 *   verified         → allowed
 *   unverified       → blocked (or retry, if reason_code = key-not-yet-logged)
 *   handle-mismatch  → blocked (the card claims a handle the
 *                       transparency log does NOT attest)
 *   stale-proof      → warning (caller decides; e.g. refresh + retry)
 *
 * No numeric trust score in any branch. The four discriminated
 * outcomes are the entire surface.
 *
 * v0.2 additions:
 *  - `verified.verified_signing_key_hex`: the agent's active signing
 *    key, propagated from foxbookVerify; lets the gateway verify the
 *    AgentCard's JWS in one call.
 *  - `unverified.reason_code` (optional): structured discriminator
 *    for retry-vs-block decisioning. `reason` (free-form string)
 *    remains for v0.1 backward compat.
 */
export type VerifyAgentCardResult =
  | {
      status: "verified";
      tier: ClaimedTier;
      did: FoxbookDid;
      leafIndex: number | null;
      verified_signing_key_hex: Ed25519PublicKeyHex;
    }
  | { status: "unverified"; reason: string; reason_code?: VerifyUnverifiedReasonCode }
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
    return { status: "unverified", reason: "card.handle missing", reason_code: "card-malformed" };
  }

  const verifyOpts: { asset_type: AssetType; asset_value: string; apiBase?: string } = {
    asset_type: options.asset_type,
    asset_value: cardHandle,
  };
  if (options.apiBase !== undefined) verifyOpts.apiBase = options.apiBase;

  const lookup = await foxbookVerify(verifyOpts);
  if ("status" in lookup) {
    if (lookup.status === "not-claimed") {
      return {
        status: "unverified",
        reason: "handle not in transparency log",
        reason_code: "handle-not-claimed",
      };
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
      return {
        status: "unverified",
        reason: "claim has no inclusion-proof leaf yet",
        reason_code: "inclusion-proof-failed",
      };
    }
    const verifyInput: VerifyInput = { leaf_index: lookup.leafIndex };
    if (options.worker_base !== undefined) verifyInput.worker_base = options.worker_base;
    if (options.apiBase !== undefined) verifyInput.api_base = options.apiBase;
    const inclusion = await verify(verifyInput);
    if (!inclusion.valid) {
      return {
        status: "unverified",
        reason: `inclusion proof failed: ${inclusion.reason}`,
        reason_code: "inclusion-proof-failed",
      };
    }
  }

  // Freshness check — pull the STH timestamp from the latest /root
  // call. We re-fetch /root rather than threading it from `verify`
  // because (a) verify might be skipped, (b) the freshness window is
  // independent of the proof check. We verify the STH signature here
  // too: an unsigned timestamp is forgeable, so a stale-or-fresh
  // decision must read off a signature-verified payload.
  if (options.requireFreshSTH !== undefined) {
    const base = trimTrailingSlash(options.worker_base ?? DEFAULT_WORKER_BASE);
    const apiBase = trimTrailingSlash(options.apiBase ?? DEFAULT_API_BASE);
    const [rootResult, wellKnownResult] = await Promise.all([
      getJson(`${base}/root`),
      getJson(`${apiBase}/.well-known/foxbook.json`),
    ]);
    if (!rootResult.ok || rootResult.response.status !== 200) {
      return {
        status: "unverified",
        reason: `cannot fetch /root for freshness: ${rootResult.ok ? `HTTP ${rootResult.response.status}` : rootResult.reason}`,
      };
    }
    const publicKeyHex = extractLogPublicKey(wellKnownResult);
    if (publicKeyHex === null) {
      return {
        status: "unverified",
        reason: "log signing public key unavailable for STH freshness check",
      };
    }
    const root = rootResult.body as Record<string, unknown>;
    const sthJws = typeof root.sthJws === "string" ? root.sthJws : null;
    if (!sthJws) {
      return { status: "unverified", reason: "/root response missing sthJws" };
    }
    const sth = await verifySthJws(sthJws, publicKeyHex);
    if (!sth.valid) {
      return { status: "unverified", reason: `STH signature verification failed: ${sth.reason}` };
    }
    const ts = sth.payload.timestamp;
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
    verified_signing_key_hex: lookup.verified_signing_key_hex,
  };
}
