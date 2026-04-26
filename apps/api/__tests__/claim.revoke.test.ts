// Handler-level tests for claimRevoke. Covers the JWS-decode, fingerprint-
// match, signature-verify, payload-rebind, and tx-handoff paths. Real
// JWS construction (Ed25519 sign) is exercised here so the test signs
// with a known recovery seed, which is the exact pattern smoke-test-revoke
// uses against live Neon.

import { canonicalJsonBytes, jwsSign, keypairFromSeed, sha256Hex } from "@foxbook/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ClaimDeps, claimRevoke, claimStart, claimVerifyGist } from "../src/claim/handlers.js";
import type { ClaimRow, MerkleAppendResult, RevocationCommitter } from "../src/claim/types.js";

type FakeState = {
  rowsById: Map<string, ClaimRow>;
  assetLookup: Map<string, string>;
  signingKeyInserts: Array<{ agentDid: string; publicKeyHex: string }>;
};

function freshState(): FakeState {
  return { rowsById: new Map(), assetLookup: new Map(), signingKeyInserts: [] };
}

// Recovery + signing keypairs derived from fixed seeds so every test
// run produces byte-identical inputs (test determinism). The seeds are
// arbitrary 32-byte values; production minting goes through @foxbook/core's
// generateKeypair (CSPRNG) per foundation §6.4.
const RECOVERY_SEED = new Uint8Array(32).fill(0x42);
const RECOVERY = keypairFromSeed(RECOVERY_SEED);
const SIGNING_SEED = new Uint8Array(32).fill(0x77);
const SIGNING = keypairFromSeed(SIGNING_SEED);

function hexFromBytes(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, "0");
  return s;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

const SIGNING_PUB_HEX = hexFromBytes(SIGNING.publicKey);
const RECOVERY_FINGERPRINT = `sha256:${sha256Hex(RECOVERY.publicKey)}`;

function fakeDeps(state: FakeState, overrides: Partial<ClaimDeps> = {}) {
  const appendSpy = vi.fn(async (leafData: unknown) => ({
    leafIndex: 1,
    leafHash: "f".repeat(64),
    rootAfter: "a".repeat(64),
    sthJws: "eyJhbGciOiJFZERTQSJ9.eyJ9.x",
    publishedAt: new Date("2026-04-26T12:00:00Z"),
    leafData,
  }));
  // Default committer impersonates the production tx body's success
  // path: returns a stubbed MerkleAppendResult, records the call.
  const revokeSpy = vi.fn<RevocationCommitter>(async ({ claim, fullLeaf }) => {
    void fullLeaf;
    void claim;
    return {
      leafIndex: 1,
      leafHash: "f".repeat(64),
      rootAfter: "a".repeat(64),
      sthJws: "eyJhbGciOiJFZERTQSJ9.eyJyZXZva2VkIjp0cnVlfQ.signature-stub",
      publishedAt: new Date("2026-04-26T12:00:00Z"),
    } satisfies MerkleAppendResult;
  });

  const deps: ClaimDeps = {
    claimRepo: {
      insertClaim: async (row) => {
        const key = `${row.assetType}:${row.assetValue}`;
        if (state.assetLookup.has(key)) return { ok: false, status: "asset-conflict" };
        const id = `claim-${state.rowsById.size + 1}`;
        const full: ClaimRow = {
          id,
          agentDid: row.agentDid,
          state: row.state,
          assetType: row.assetType,
          assetValue: row.assetValue,
          ed25519PublicKeyHex: row.ed25519PublicKeyHex,
          recoveryKeyFingerprint: row.recoveryKeyFingerprint,
          verificationCode: row.verificationCode,
          startedAt: new Date("2026-04-26T11:00:00Z"),
          completedAt: null,
        };
        state.rowsById.set(id, full);
        state.assetLookup.set(key, id);
        return { ok: true, id };
      },
      findById: async (id) => state.rowsById.get(id) ?? null,
      markTier1Verified: async (id) => {
        const r = state.rowsById.get(id);
        if (r)
          state.rowsById.set(id, {
            ...r,
            state: "tier1_verified",
            completedAt: new Date("2026-04-26T11:30:00Z"),
          });
      },
      insertSigningKey: async (agentDid, publicKeyHex) => {
        state.signingKeyInserts.push({ agentDid, publicKeyHex });
      },
    },
    gist: { verifyGistContainsCode: vi.fn(async () => ({ status: "match" as const, body: "ok" })) },
    merkle: { append: appendSpy },
    revocationCommitter: revokeSpy,
    ...overrides,
  };
  return { deps, appendSpy, revokeSpy };
}

const GOOD_INPUT = {
  assetType: "github_handle" as const,
  assetValue: "cloakmaster",
  ed25519PublicKeyHex: SIGNING_PUB_HEX,
  recoveryKeyFingerprint: RECOVERY_FINGERPRINT,
};

async function setupTier1Verified(state: FakeState, deps: ClaimDeps) {
  const started = await claimStart(GOOD_INPUT, deps);
  if (!started.ok) throw new Error("setup: claimStart failed");
  const verified = await claimVerifyGist(
    { claimId: started.claim.id, gistUrl: "https://gist.github.com/cloakmaster/abc" },
    deps,
  );
  if (!verified.ok) throw new Error("setup: claimVerifyGist failed");
  // Re-fetch claim with the updated state for tests.
  const fresh = state.rowsById.get(started.claim.id);
  if (!fresh) throw new Error("setup: claim row vanished");
  return fresh;
}

/**
 * Build a real revocation JWS using the recovery keypair. Returns the
 * compact JWS string that POST /claim/revoke expects in
 * revocation_record_jws. The signed payload is the leaf body sans
 * recovery_key_signature, in alphabetical key order — matching what the
 * handler reconstructs for verification.
 */
function buildRevocationJws(
  payload: {
    did: string;
    revoked_key_hex: string;
    revocation_timestamp: string;
    reason_code?: "key_compromise" | "owner_request" | "superseded";
  },
  recoveryPriv: Uint8Array = RECOVERY.privateKey,
  recoveryPub: Uint8Array = RECOVERY.publicKey,
): string {
  // Insertion order = alphabetical = canonical signing-input order.
  const signed: Record<string, unknown> = {};
  signed.did = payload.did;
  signed.leaf_type = "revocation";
  if (payload.reason_code !== undefined) signed.reason_code = payload.reason_code;
  signed.revocation_timestamp = payload.revocation_timestamp;
  signed.revoked_key_hex = payload.revoked_key_hex;
  // canonicalJsonBytes is what jwsSign uses internally; we don't need
  // to hash here, we just need to make sure the object's key order
  // makes JSON.stringify produce the alphabetical bytes.
  void canonicalJsonBytes;
  return jwsSign(
    {
      alg: "EdDSA",
      typ: "JWT",
      jwk: { kty: "OKP", crv: "Ed25519", x: base64url(recoveryPub) },
    },
    signed,
    recoveryPriv,
  );
}

describe("claimRevoke — happy path", () => {
  let state: FakeState;
  let deps: ClaimDeps;
  let revokeSpy: ReturnType<typeof fakeDeps>["revokeSpy"];
  let claim: ClaimRow;

  beforeEach(async () => {
    state = freshState();
    const built = fakeDeps(state);
    deps = built.deps;
    revokeSpy = built.revokeSpy;
    claim = await setupTier1Verified(state, deps);
  });

  it("returns ok + leaf coordinates when JWS verifies + payload binds to claim", async () => {
    const jws = buildRevocationJws({
      did: claim.agentDid,
      revoked_key_hex: claim.ed25519PublicKeyHex,
      revocation_timestamp: "2026-04-26T12:00:00Z",
      reason_code: "owner_request",
    });
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revoked).toBe(true);
      expect(result.leafIndex).toBe(1);
      expect(result.leafHash).toBe("f".repeat(64));
    }
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    const committerInput = revokeSpy.mock.calls[0]?.[0];
    expect(committerInput?.claim.id).toBe(claim.id);
    const fullLeaf = committerInput?.fullLeaf as Record<string, unknown>;
    expect(fullLeaf.leaf_type).toBe("revocation");
    expect(fullLeaf.did).toBe(claim.agentDid);
    expect(fullLeaf.revoked_key_hex).toBe(claim.ed25519PublicKeyHex);
    expect(fullLeaf.recovery_key_signature).toBe(jws);
    expect(fullLeaf.reason_code).toBe("owner_request");
  });

  it("accepts revocation without reason_code (optional field)", async () => {
    const jws = buildRevocationJws({
      did: claim.agentDid,
      revoked_key_hex: claim.ed25519PublicKeyHex,
      revocation_timestamp: "2026-04-26T12:00:00Z",
    });
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(true);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    const fullLeaf = revokeSpy.mock.calls[0]?.[0]?.fullLeaf as Record<string, unknown>;
    expect("reason_code" in fullLeaf).toBe(false);
  });
});

describe("claimRevoke — negative paths (none of which call revocationCommitter)", () => {
  it("not-found-claim when claim id doesn't exist", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const jws = buildRevocationJws({
      did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      revoked_key_hex: SIGNING_PUB_HEX,
      revocation_timestamp: "2026-04-26T12:00:00Z",
    });
    const result = await claimRevoke({ claimId: "ghost", revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("not-found-claim");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("bad-state when claim is not tier1_verified yet (still gist_pending)", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup: claimStart failed");
    // Note: NOT calling claimVerifyGist, so state stays gist_pending.
    const jws = buildRevocationJws({
      did: started.claim.agentDid,
      revoked_key_hex: SIGNING_PUB_HEX,
      revocation_timestamp: "2026-04-26T12:00:00Z",
    });
    const result = await claimRevoke({ claimId: started.claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("bad-state");
      if (result.status === "bad-state") {
        expect(result.currentState).toBe("gist_pending");
      }
    }
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("recovery-key-mismatch when JWS jwk fingerprint != claim.recovery_key_fingerprint", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    // Sign with a DIFFERENT recovery seed.
    const wrongSeed = new Uint8Array(32).fill(0xff);
    const wrong = keypairFromSeed(wrongSeed);
    const jws = buildRevocationJws(
      {
        did: claim.agentDid,
        revoked_key_hex: claim.ed25519PublicKeyHex,
        revocation_timestamp: "2026-04-26T12:00:00Z",
      },
      wrong.privateKey,
      wrong.publicKey,
    );
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("recovery-key-mismatch");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("recovery-key-signature-invalid when JWS not 3-segment compact form", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    const result = await claimRevoke(
      { claimId: claim.id, revocationRecordJws: "two.segments" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("recovery-key-signature-invalid");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("recovery-key-signature-invalid when alg is not EdDSA", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    // Construct a token with alg=HS256 in header. Signature validity
    // doesn't matter — we should reject before checking the signature.
    const headerBad = base64url(
      new TextEncoder().encode(
        JSON.stringify({
          alg: "HS256",
          jwk: { kty: "OKP", crv: "Ed25519", x: base64url(RECOVERY.publicKey) },
        }),
      ),
    );
    const payloadOk = base64url(
      new TextEncoder().encode(
        JSON.stringify({
          did: claim.agentDid,
          leaf_type: "revocation",
          revocation_timestamp: "2026-04-26T12:00:00Z",
          revoked_key_hex: claim.ed25519PublicKeyHex,
        }),
      ),
    );
    const fakeSig = base64url(new Uint8Array(64));
    const tok = `${headerBad}.${payloadOk}.${fakeSig}`;
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: tok }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("recovery-key-signature-invalid");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("recovery-key-signature-invalid when signature bytes don't verify", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    // Build a real JWS, then tamper the signature segment.
    const real = buildRevocationJws({
      did: claim.agentDid,
      revoked_key_hex: claim.ed25519PublicKeyHex,
      revocation_timestamp: "2026-04-26T12:00:00Z",
    });
    const realParts = real.split(".");
    const tampered = `${realParts[0]}.${realParts[1]}.${base64url(new Uint8Array(64))}`;
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: tampered }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("recovery-key-signature-invalid");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("invalid-leaf when payload.did !== claim.agent_did (recovery-key-holder spoofing a different did)", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    // The recovery key is correct, but the payload references a different did.
    const jws = buildRevocationJws({
      did: "did:foxbook:01HXYZABCDEFGHJKMNPQRSTVW42",
      revoked_key_hex: claim.ed25519PublicKeyHex,
      revocation_timestamp: "2026-04-26T12:00:00Z",
    });
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("invalid-leaf");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("invalid-leaf when payload.revoked_key_hex !== claim.ed25519_public_key_hex", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    const jws = buildRevocationJws({
      did: claim.agentDid,
      revoked_key_hex: "0".repeat(64),
      revocation_timestamp: "2026-04-26T12:00:00Z",
    });
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("invalid-leaf");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("invalid-leaf when payload has unknown reason_code (validateTlLeaf rejects)", async () => {
    const state = freshState();
    const { deps, revokeSpy } = fakeDeps(state);
    const claim = await setupTier1Verified(state, deps);
    // Sign a payload with a bogus reason_code. The JWS verifies fine
    // (we own both keys) but the schema validator rejects.
    const jws = buildRevocationJws({
      did: claim.agentDid,
      revoked_key_hex: claim.ed25519PublicKeyHex,
      revocation_timestamp: "2026-04-26T12:00:00Z",
      reason_code: "bad_reason" as "owner_request",
    });
    const result = await claimRevoke({ claimId: claim.id, revocationRecordJws: jws }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("invalid-leaf");
    expect(revokeSpy).not.toHaveBeenCalled();
  });
});
