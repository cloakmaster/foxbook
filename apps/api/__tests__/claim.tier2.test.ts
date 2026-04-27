// Handler-level tests for the Day-7 PR C tier-2 verification flow.
// Covers claimStartDomain, claimVerifyDns, claimVerifyEndpoint and
// asserts the discriminated status pass-through from the adapters.

import { describe, expect, it, vi } from "vitest";

import {
  type ClaimDeps,
  claimStartDomain,
  claimVerifyDns,
  claimVerifyEndpoint,
} from "../src/claim/handlers.js";
import type { ClaimRow } from "../src/claim/types.js";

type FakeState = {
  rowsById: Map<string, ClaimRow>;
  assetLookup: Map<string, string>;
};

function freshState(): FakeState {
  return { rowsById: new Map(), assetLookup: new Map() };
}

function fakeDeps(state: FakeState, overrides: Partial<ClaimDeps> = {}) {
  const dnsSpy = vi.fn();
  const endpointSpy = vi.fn();

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
          startedAt: new Date("2026-04-27T08:00:00Z"),
          completedAt: null,
        };
        state.rowsById.set(id, full);
        state.assetLookup.set(key, id);
        return { ok: true, id };
      },
      findById: async (id) => state.rowsById.get(id) ?? null,
      markTier2Verified: async (id) => {
        const r = state.rowsById.get(id);
        if (r)
          state.rowsById.set(id, {
            ...r,
            state: "tier2_verified",
            completedAt: new Date("2026-04-27T08:30:00Z"),
          });
      },
    },
    gist: {
      verifyGistContainsCode: vi.fn(async () => {
        throw new Error("tier-2 tests should not call gist");
      }),
    },
    dns: { verifyDnsTxtContainsCode: dnsSpy },
    endpoint: { verifyEndpointSignedNonce: endpointSpy },
    verificationCommitter: vi.fn(async () => {
      throw new Error("tier-2 tests should not call verificationCommitter");
    }),
    revocationCommitter: vi.fn(async () => {
      throw new Error("tier-2 tests should not call revocationCommitter");
    }),
    ...overrides,
  };
  return { deps, dnsSpy, endpointSpy };
}

const DOMAIN_INPUT = {
  assetValue: "acme.example",
  ed25519PublicKeyHex: "a".repeat(64),
  recoveryKeyFingerprint: `sha256:${"c".repeat(64)}`,
};

describe("claimStartDomain", () => {
  it("creates a tier2_pending claim with a fresh verification_code", async () => {
    const state = freshState();
    const { deps } = fakeDeps(state);
    const result = await claimStartDomain(DOMAIN_INPUT, deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claim.state).toBe("tier2_pending");
      expect(result.claim.assetType).toBe("domain");
      expect(result.claim.assetValue).toBe("acme.example");
      expect(result.claim.verificationCode).toHaveLength(32);
    }
  });

  it("returns asset-conflict when (domain, asset_value) is already claimed", async () => {
    const state = freshState();
    const { deps } = fakeDeps(state);
    const r1 = await claimStartDomain(DOMAIN_INPUT, deps);
    expect(r1.ok).toBe(true);
    const r2 = await claimStartDomain(DOMAIN_INPUT, deps);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe("asset-conflict");
  });
});

describe("claimVerifyDns — discriminated status pass-through", () => {
  it("match → tier2_verified, returns ok+tier=2", async () => {
    const state = freshState();
    const { deps, dnsSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    dnsSpy.mockResolvedValueOnce({ status: "match" });
    const result = await claimVerifyDns({ claimId: started.claim.id }, deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tier).toBe(2);
    expect(state.rowsById.get(started.claim.id)?.state).toBe("tier2_verified");
  });

  it("not-found from adapter → status=not-found, no transition", async () => {
    const state = freshState();
    const { deps, dnsSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    dnsSpy.mockResolvedValueOnce({ status: "not-found" });
    const result = await claimVerifyDns({ claimId: started.claim.id }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("not-found");
    expect(state.rowsById.get(started.claim.id)?.state).toBe("tier2_pending");
  });

  it("still-pending → caller polls; no transition", async () => {
    const state = freshState();
    const { deps, dnsSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    dnsSpy.mockResolvedValueOnce({ status: "still-pending" });
    const result = await claimVerifyDns({ claimId: started.claim.id }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("still-pending");
  });

  it("identity-mismatch surfaces foundCode for operator visibility", async () => {
    const state = freshState();
    const { deps, dnsSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    dnsSpy.mockResolvedValueOnce({
      status: "identity-mismatch",
      reason: "different code",
      foundCode: "OTHERAGENTCODE",
    });
    const result = await claimVerifyDns({ claimId: started.claim.id }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("identity-mismatch");
      if (result.status === "identity-mismatch") expect(result.foundCode).toBe("OTHERAGENTCODE");
    }
  });

  it("error/servfail → status=error, reason preserved", async () => {
    const state = freshState();
    const { deps, dnsSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    dnsSpy.mockResolvedValueOnce({ status: "error", reason: "servfail" });
    const result = await claimVerifyDns({ claimId: started.claim.id }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok && result.status === "error") {
      expect(result.reason).toBe("servfail");
    }
  });

  it("wrong-asset-type when claim is github_handle (not domain)", async () => {
    const state = freshState();
    const { deps } = fakeDeps(state);
    const githubClaim: ClaimRow = {
      id: "claim-99",
      agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      state: "tier2_pending",
      assetType: "github_handle",
      assetValue: "alice",
      ed25519PublicKeyHex: "a".repeat(64),
      recoveryKeyFingerprint: `sha256:${"c".repeat(64)}`,
      verificationCode: "X".repeat(32),
      startedAt: new Date(),
      completedAt: null,
    };
    state.rowsById.set("claim-99", githubClaim);
    const result = await claimVerifyDns({ claimId: "claim-99" }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe("wrong-asset-type");
  });
});

describe("claimVerifyEndpoint — discriminated status pass-through", () => {
  it("match → tier2_verified, returns ok+tier=2", async () => {
    const state = freshState();
    const { deps, endpointSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    endpointSpy.mockResolvedValueOnce({ status: "match" });
    const result = await claimVerifyEndpoint(
      { claimId: started.claim.id, endpointUrl: "https://acme.example/.well-known/foxbook" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tier).toBe(2);
    expect(state.rowsById.get(started.claim.id)?.state).toBe("tier2_verified");
    // Verify the adapter received a 64-char hex nonce.
    const callArg = endpointSpy.mock.calls[0]!;
    const sentNonce = callArg[1] as string;
    expect(sentNonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signature-invalid passes reason through unchanged", async () => {
    const state = freshState();
    const { deps, endpointSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    endpointSpy.mockResolvedValueOnce({
      status: "signature-invalid",
      reason: "Ed25519 verification failed",
    });
    const result = await claimVerifyEndpoint(
      { claimId: started.claim.id, endpointUrl: "https://acme.example/sig" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.status === "signature-invalid") {
      expect(result.reason).toContain("Ed25519");
    }
  });

  it("nonce-mismatch surfaces sent + received for replay diagnosis", async () => {
    const state = freshState();
    const { deps, endpointSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    endpointSpy.mockResolvedValueOnce({
      status: "nonce-mismatch",
      sent: "ab".repeat(32),
      received: "cd".repeat(32),
    });
    const result = await claimVerifyEndpoint(
      { claimId: started.claim.id, endpointUrl: "https://acme.example/sig" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.status === "nonce-mismatch") {
      expect(result.sent.length).toBe(64);
      expect(result.received.length).toBe(64);
    }
  });

  it("error from adapter passes through with reason + detail", async () => {
    const state = freshState();
    const { deps, endpointSpy } = fakeDeps(state);
    const started = await claimStartDomain(DOMAIN_INPUT, deps);
    if (!started.ok) throw new Error("setup failed");
    endpointSpy.mockResolvedValueOnce({
      status: "error",
      reason: "http_error",
      detail: "endpoint returned HTTP 500",
    });
    const result = await claimVerifyEndpoint(
      { claimId: started.claim.id, endpointUrl: "https://acme.example/sig" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.status === "error") {
      expect(result.reason).toBe("http_error");
      expect(result.detail).toContain("HTTP 500");
    }
  });
});
