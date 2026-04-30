// Day-9 PR-A2 — GET /api/v1/claim/by-handle/:asset_type/:asset_value.
// Tests the handler's discriminated outcomes + the route layer's
// HTTP shape + Cache-Control + AJV validation against
// schemas/claim-by-handle.v1.json.

import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";

import claimByHandleSchema from "../../../schemas/claim-by-handle.v1.json" with {
  type: "json",
};
import {
  claimByHandle,
  claimByHandleResponseShape,
  type ClaimDeps,
} from "../src/claim/handlers.js";
import { claimRoute } from "../src/claim/route.js";
import type { ClaimRow } from "../src/claim/types.js";

type AjvInstance = InstanceType<typeof Ajv2020>;
const addFormats = addFormatsModule as unknown as (a: AjvInstance) => AjvInstance;

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateClaimByHandle = ajv.compile(claimByHandleSchema);

type FakeState = {
  rowsById: Map<string, ClaimRow>;
  assetLookup: Map<string, string>;
  leafIndexByDid: Map<string, number>;
};

function freshState(): FakeState {
  return {
    rowsById: new Map(),
    assetLookup: new Map(),
    leafIndexByDid: new Map(),
  };
}

function fakeDeps(state: FakeState): ClaimDeps {
  return {
    claimRepo: {
      insertClaim: async () => ({ ok: false, status: "asset-conflict" }),
      findById: async (id) => state.rowsById.get(id) ?? null,
      markTier2Verified: async () => {},
      findByAsset: async (assetType, assetValue) => {
        const id = state.assetLookup.get(`${assetType}:${assetValue}`);
        return id ? state.rowsById.get(id) ?? null : null;
      },
      findLatestLeafIndexForDid: async (did) => state.leafIndexByDid.get(did) ?? null,
    },
    gist: {
      verifyGistContainsCode: async () => {
        throw new Error("not called");
      },
    },
    dns: {
      verifyDnsTxtContainsCode: async () => {
        throw new Error("not called");
      },
    },
    endpoint: {
      verifyEndpointSignedNonce: async () => {
        throw new Error("not called");
      },
    },
    verificationCommitter: async () => {
      throw new Error("not called");
    },
    revocationCommitter: async () => {
      throw new Error("not called");
    },
  };
}

function seedClaim(state: FakeState, partial: Partial<ClaimRow> & Pick<ClaimRow, "agentDid" | "assetType" | "assetValue" | "state">): ClaimRow {
  const id = `claim-${state.rowsById.size + 1}`;
  const row: ClaimRow = {
    id,
    agentDid: partial.agentDid,
    state: partial.state,
    assetType: partial.assetType,
    assetValue: partial.assetValue,
    ed25519PublicKeyHex: partial.ed25519PublicKeyHex ?? "f".repeat(64),
    recoveryKeyFingerprint: partial.recoveryKeyFingerprint ?? `sha256:${"a".repeat(64)}`,
    verificationCode: partial.verificationCode ?? "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
    startedAt: partial.startedAt ?? new Date("2026-04-30T10:00:00Z"),
    completedAt: partial.completedAt ?? null,
  };
  state.rowsById.set(id, row);
  state.assetLookup.set(`${row.assetType}:${row.assetValue}`, id);
  return row;
}

describe("claimByHandle handler", () => {
  it("returns ok+claim with leafIndex for a tier1_verified row", async () => {
    const state = freshState();
    seedClaim(state, {
      agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      assetType: "github_handle",
      assetValue: "alice",
      state: "tier1_verified",
    });
    state.leafIndexByDid.set("did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M", 7);

    const result = await claimByHandle(
      { assetType: "github_handle", assetValue: "alice" },
      fakeDeps(state),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.claim.assetValue).toBe("alice");
    expect(result.leafIndex).toBe(7);
  });

  it("returns ok+claim with leafIndex=null for gist_pending (no leaf yet)", async () => {
    const state = freshState();
    seedClaim(state, {
      agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      assetType: "github_handle",
      assetValue: "bob",
      state: "gist_pending",
    });
    state.leafIndexByDid.set("did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M", 7);

    const result = await claimByHandle(
      { assetType: "github_handle", assetValue: "bob" },
      fakeDeps(state),
    );
    if (!result.ok) throw new Error("expected ok");
    expect(result.leafIndex).toBeNull();
  });

  it("returns not-claimed for unknown handle", async () => {
    const result = await claimByHandle(
      { assetType: "github_handle", assetValue: "nobody" },
      fakeDeps(freshState()),
    );
    expect(result).toEqual({ ok: false, status: "not-claimed" });
  });

  it("response shape conforms to schemas/claim-by-handle.v1.json (tier1_verified)", () => {
    const claim: ClaimRow = {
      id: "claim-1",
      agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      state: "tier1_verified",
      assetType: "github_handle",
      assetValue: "alice",
      ed25519PublicKeyHex: "f".repeat(64),
      recoveryKeyFingerprint: `sha256:${"a".repeat(64)}`,
      verificationCode: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
      startedAt: new Date(),
      completedAt: null,
    };
    const body = claimByHandleResponseShape(
      { ok: true, claim, leafIndex: 7 },
      "https://transparency.foxbook.dev",
    );
    const valid = validateClaimByHandle(body);
    if (!valid) {
      console.error(validateClaimByHandle.errors);
    }
    expect(valid).toBe(true);
    expect(body.verification_tier).toBe(1);
    expect(body.leaf_index).toBe(7);
    expect(body.inclusion_proof_url).toBe("https://transparency.foxbook.dev/inclusion/7");
    expect(body.revoked).toBe(false);
  });

  it("response shape conforms to schema (gist_pending, no leaf_index)", () => {
    const claim: ClaimRow = {
      id: "claim-2",
      agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      state: "gist_pending",
      assetType: "github_handle",
      assetValue: "bob",
      ed25519PublicKeyHex: "f".repeat(64),
      recoveryKeyFingerprint: `sha256:${"a".repeat(64)}`,
      verificationCode: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
      startedAt: new Date(),
      completedAt: null,
    };
    const body = claimByHandleResponseShape(
      { ok: true, claim, leafIndex: null },
      "https://transparency.foxbook.dev",
    );
    const valid = validateClaimByHandle(body);
    if (!valid) console.error(validateClaimByHandle.errors);
    expect(valid).toBe(true);
    expect(body.verification_tier).toBe(0);
    expect(body.leaf_index).toBeUndefined();
    expect(body.inclusion_proof_url).toBeUndefined();
  });
});

// ---- Route layer ----

function makeRouteApp(state: FakeState) {
  const app = claimRoute(fakeDeps(state));
  // The route is mounted under /api/v1/* in production; in tests we
  // call the route directly so the path is /claim/by-handle/...
  return app;
}

describe("GET /claim/by-handle/:asset_type/:asset_value (route)", () => {
  it("200 + Cache-Control + JSON schema-valid body for tier1 claim", async () => {
    const state = freshState();
    seedClaim(state, {
      agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      assetType: "github_handle",
      assetValue: "alice",
      state: "tier1_verified",
    });
    state.leafIndexByDid.set("did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M", 3);

    const res = await makeRouteApp(state).request("/claim/by-handle/github_handle/alice");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, must-revalidate");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.asset_value).toBe("alice");
    expect(body.verification_tier).toBe(1);
    expect(body.leaf_index).toBe(3);
    expect(body.inclusion_proof_url).toBe("https://transparency.foxbook.dev/inclusion/3");
    expect(validateClaimByHandle(body)).toBe(true);
  });

  it("404 + JSON not-claimed body + Cache-Control on unknown handle", async () => {
    const state = freshState();
    const res = await makeRouteApp(state).request("/claim/by-handle/github_handle/nobody");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=60, must-revalidate");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      error: "not-claimed",
      asset_type: "github_handle",
      asset_value: "nobody",
    });
  });

  it("400 on invalid asset_type", async () => {
    const res = await makeRouteApp(freshState()).request("/claim/by-handle/email/foo@bar");
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid-asset-type");
    expect(body.asset_type).toBe("email");
  });

  it("404 (route-level) when asset_value is empty (Hono path-param requires non-empty)", async () => {
    // Hono's :asset_value param won't match an empty segment; the
    // request falls through to a 404. This documents the behaviour
    // rather than depending on our handler's missing-asset-value 400.
    const res = await makeRouteApp(freshState()).request("/claim/by-handle/github_handle/");
    expect([400, 404]).toContain(res.status);
  });
});
