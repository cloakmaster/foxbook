import { describe, expect, it, vi } from "vitest";

import type {
  ClaimDeps,
  claimStart as claimStartType,
  claimVerifyGist as claimVerifyGistType,
} from "../src/claim/handlers.js";
import { claimStart, claimVerifyGist } from "../src/claim/handlers.js";
import type { ClaimRow } from "../src/claim/types.js";

void (null as unknown as typeof claimStartType);
void (null as unknown as typeof claimVerifyGistType);

type FakeState = {
  rowsById: Map<string, ClaimRow>;
  assetLookup: Map<string, string>; // "type:value" -> id
  signingKeyInserts: Array<{ agentDid: string; publicKeyHex: string }>;
};

function freshState(): FakeState {
  return { rowsById: new Map(), assetLookup: new Map(), signingKeyInserts: [] };
}

function fakeClaimDeps(
  state: FakeState,
  overrides: Partial<ClaimDeps> = {},
): { deps: ClaimDeps; appendSpy: ReturnType<typeof vi.fn>; gistSpy: ReturnType<typeof vi.fn> } {
  const appendSpy = vi.fn(async (leafData: unknown) => ({
    leafIndex: 0,
    leafHash: "f".repeat(64),
    rootAfter: "a".repeat(64),
    sthJws: "eyJhbGciOiJFZERTQSJ9.eyJ9.x",
    publishedAt: new Date("2026-04-23T10:00:00Z"),
    leafData, // for assertion
  }));
  const gistSpy = vi.fn(async () => ({ status: "match" as const, body: "ok" }));

  // claimStart and claimVerifyGist don't call revocationCommitter; the
  // default fake throws if it's ever invoked so a regression in the
  // happy path doesn't silently exercise revocation code.
  const revokeSpy = vi.fn(async () => {
    throw new Error("revocationCommitter should not be called by claimStart/claimVerifyGist");
  });

  const deps: ClaimDeps = {
    claimRepo: {
      insertClaim: async (row) => {
        const key = `${row.assetType}:${row.assetValue}`;
        if (state.assetLookup.has(key)) {
          return { ok: false, status: "asset-conflict" };
        }
        const id = `claim-${state.rowsById.size + 1}`;
        const fullRow: ClaimRow = {
          id,
          agentDid: row.agentDid,
          state: row.state,
          assetType: row.assetType,
          assetValue: row.assetValue,
          ed25519PublicKeyHex: row.ed25519PublicKeyHex,
          recoveryKeyFingerprint: row.recoveryKeyFingerprint,
          verificationCode: row.verificationCode,
          startedAt: new Date("2026-04-23T09:00:00Z"),
          completedAt: null,
        };
        state.rowsById.set(id, fullRow);
        state.assetLookup.set(key, id);
        return { ok: true, id };
      },
      findById: async (id) => state.rowsById.get(id) ?? null,
      markTier1Verified: async (id) => {
        const r = state.rowsById.get(id);
        if (r) state.rowsById.set(id, { ...r, state: "tier1_verified" });
      },
      insertSigningKey: async (agentDid, publicKeyHex) => {
        state.signingKeyInserts.push({ agentDid, publicKeyHex });
      },
      markTier2Verified: async (id) => {
        const r = state.rowsById.get(id);
        if (r) state.rowsById.set(id, { ...r, state: "tier2_verified" });
      },
    },
    gist: { verifyGistContainsCode: gistSpy },
    // PR C: DNS + endpoint adapter fakes default to throwing — these
    // tests exercise the Tier-1 path; calling Tier-2 by accident
    // should fail loudly rather than silently no-op.
    dns: {
      verifyDnsTxtContainsCode: vi.fn(async () => {
        throw new Error("dns.verifyDnsTxtContainsCode should not be called by tier-1 tests");
      }),
    },
    endpoint: {
      verifyEndpointSignedNonce: vi.fn(async () => {
        throw new Error("endpoint.verifyEndpointSignedNonce should not be called by tier-1 tests");
      }),
    },
    merkle: { append: appendSpy },
    revocationCommitter: revokeSpy,
    ...overrides,
  };
  return { deps, appendSpy, gistSpy };
}

const GOOD_INPUT = {
  assetType: "github_handle" as const,
  assetValue: "samrg472",
  ed25519PublicKeyHex: "a".repeat(64),
  recoveryKeyFingerprint: `sha256:${"c".repeat(64)}`,
};

describe("claimStart", () => {
  it("mints a did + verification_code, inserts claim, returns ok", async () => {
    const state = freshState();
    const { deps } = fakeClaimDeps(state);
    const result = await claimStart(GOOD_INPUT, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claim.agentDid).toMatch(/^did:foxbook:[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(result.claim.verificationCode).toHaveLength(32);
      expect(result.claim.state).toBe("gist_pending");
    }
    expect(state.rowsById.size).toBe(1);
  });

  it("uses a caller-provided did if supplied", async () => {
    const state = freshState();
    const { deps } = fakeClaimDeps(state);
    const caller = "did:foxbook:01HXYZABCDEFGHJKMNPQRSTVW42";
    const result = await claimStart({ ...GOOD_INPUT, agentDid: caller }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.claim.agentDid).toBe(caller);
  });

  it("returns asset-conflict when (asset_type, asset_value) already claimed", async () => {
    const state = freshState();
    const { deps } = fakeClaimDeps(state);
    const r1 = await claimStart(GOOD_INPUT, deps);
    expect(r1.ok).toBe(true);
    const r2 = await claimStart(GOOD_INPUT, deps);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe("asset-conflict");
  });
});

describe("claimVerifyGist — happy path", () => {
  it("on match: markTier1Verified, insertSigningKey, append leaf, return tier=1", async () => {
    const state = freshState();
    const { deps, appendSpy, gistSpy } = fakeClaimDeps(state);
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup: claimStart failed");

    const result = await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/samrg472/abc123" },
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe(1);
      expect(result.leafIndex).toBe(0);
    }
    expect(gistSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(state.signingKeyInserts).toHaveLength(1);
    expect(state.rowsById.get(started.claim.id)?.state).toBe("tier1_verified");
  });

  it("append is called with the exact agent-key-registration leaf shape", async () => {
    const state = freshState();
    const { deps, appendSpy } = fakeClaimDeps(state);
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup: claimStart failed");

    await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/samrg472/abc123" },
      deps,
    );

    const leafData = appendSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(leafData.leaf_type).toBe("agent-key-registration");
    expect(leafData.did).toBe(started.claim.agentDid);
    expect(leafData.ed25519_public_key_hex).toBe(GOOD_INPUT.ed25519PublicKeyHex);
    expect(leafData.recovery_key_fingerprint).toBe(GOOD_INPUT.recoveryKeyFingerprint);
    expect(typeof leafData.published_at).toBe("string");
  });
});

describe("claimVerifyGist — negative paths (all of which MUST NOT call append)", () => {
  it("not-found-claim: unknown claim_id → 404-equivalent, no side effects", async () => {
    const state = freshState();
    const { deps, appendSpy, gistSpy } = fakeClaimDeps(state);
    const result = await claimVerifyGist(
      { claimId: "does-not-exist", gistUrl: "https://gist.github.com/samrg472/abc" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("not-found-claim");
    expect(appendSpy).not.toHaveBeenCalled();
    expect(gistSpy).not.toHaveBeenCalled();
  });

  it("wrong-asset-type: x_handle or domain → 400, no Gist call", async () => {
    const state = freshState();
    const { deps, appendSpy, gistSpy } = fakeClaimDeps(state);
    const started = await claimStart(
      { ...GOOD_INPUT, assetType: "domain", assetValue: "acme.com" },
      deps,
    );
    if (!started.ok) throw new Error("setup failed");
    const result = await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/foo/bar" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("wrong-asset-type");
    expect(gistSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("identity-mismatch from Gist adapter → no append, no state transition", async () => {
    const state = freshState();
    const { deps, appendSpy } = fakeClaimDeps(state, {
      gist: {
        verifyGistContainsCode: vi.fn(async () => ({
          status: "identity-mismatch" as const,
          reason: "owner mismatch",
        })),
      },
    });
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    const result = await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/evil/abc" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("identity-mismatch");
    expect(appendSpy).not.toHaveBeenCalled();
    expect(state.rowsById.get(started.claim.id)?.state).toBe("gist_pending");
  });

  it("still-pending from Gist → no append, claim stays gist_pending", async () => {
    const state = freshState();
    const { deps, appendSpy } = fakeClaimDeps(state, {
      gist: { verifyGistContainsCode: vi.fn(async () => ({ status: "still-pending" as const })) },
    });
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    const result = await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/samrg472/abc" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("still-pending");
    expect(appendSpy).not.toHaveBeenCalled();
    expect(state.rowsById.get(started.claim.id)?.state).toBe("gist_pending");
  });

  it("not-found (Gist 404) from adapter → no append", async () => {
    const state = freshState();
    const { deps, appendSpy } = fakeClaimDeps(state, {
      gist: { verifyGistContainsCode: vi.fn(async () => ({ status: "not-found" as const })) },
    });
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    const result = await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/samrg472/abc" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("not-found");
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("claim not in gist_pending state → bad-request, no append", async () => {
    const state = freshState();
    const { deps, appendSpy, gistSpy } = fakeClaimDeps(state);
    const started = await claimStart(GOOD_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    // simulate claim already verified
    state.rowsById.set(started.claim.id, {
      ...started.claim,
      state: "tier1_verified",
    });
    const result = await claimVerifyGist(
      { claimId: started.claim.id, gistUrl: "https://gist.github.com/samrg472/abc" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("bad-request");
    expect(gistSpy).not.toHaveBeenCalled();
    expect(appendSpy).not.toHaveBeenCalled();
  });
});
