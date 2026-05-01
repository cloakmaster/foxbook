// PR-A3 — claim.ts implementation tests. Stubs globalThis.fetch with
// shaped responses; covers each discriminated outcome for claimStart,
// claimVerifyGist, claimRevoke + DEFAULT_API_BASE wiring + apiBase
// override + URL/body shape per server contract.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ClaimStartInput,
  type ClaimVerifyGistInput,
  type ClaimRevokeInput,
  DEFAULT_API_BASE,
  claimRevoke,
  claimStart,
  claimVerifyGist,
} from "../src/claim.js";

// ---- fetch stubbing ----

type FetchResponse = {
  status: number;
  body: unknown;
};

let mockFetch: ReturnType<typeof vi.fn>;
let lastRequest: { url: string; method: string; headers: Record<string, string>; body: unknown } | null;

function stubFetchSequence(...responses: FetchResponse[]): void {
  let i = 0;
  mockFetch.mockImplementation(async (url: string, init: RequestInit) => {
    lastRequest = {
      url,
      method: (init?.method as string) ?? "GET",
      headers: (init?.headers as Record<string, string>) ?? {},
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    };
    const r = responses[i] ?? responses[responses.length - 1];
    if (!r) throw new Error("test bug: no response configured");
    i++;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function stubFetchThrows(reason: string): void {
  mockFetch.mockImplementation(async () => {
    throw new Error(reason);
  });
}

function stubFetchNonJson(): void {
  mockFetch.mockImplementation(async () => new Response("not json", { status: 500 }));
}

beforeEach(() => {
  mockFetch = vi.fn();
  lastRequest = null;
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---- Common ----

const GOOD_START: ClaimStartInput = {
  asset_type: "github_handle",
  asset_value: "alice",
  ed25519_public_key_hex: "f".repeat(64),
  recovery_key_fingerprint: `sha256:${"a".repeat(64)}`,
};

describe("DEFAULT_API_BASE", () => {
  it("points at the deployed Fly app", () => {
    expect(DEFAULT_API_BASE).toBe("https://api.foxbook.dev");
  });
});

// ---- claimStart ----

describe("claimStart", () => {
  it("constructs POST {api}/api/v1/claim/start with correct headers + body", async () => {
    stubFetchSequence({
      status: 201,
      body: {
        claim_id: "11111111-1111-1111-1111-111111111111",
        agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        verification_code: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
        state: "gist_pending",
        instructions: "...",
      },
    });
    await claimStart(GOOD_START);
    expect(lastRequest?.url).toBe("https://api.foxbook.dev/api/v1/claim/start");
    expect(lastRequest?.method).toBe("POST");
    expect(lastRequest?.headers["Content-Type"]).toBe("application/json");
    expect(lastRequest?.body).toEqual({
      asset_type: "github_handle",
      asset_value: "alice",
      ed25519_public_key_hex: "f".repeat(64),
      recovery_key_fingerprint: `sha256:${"a".repeat(64)}`,
    });
  });

  it("includes agent_did in body when supplied", async () => {
    stubFetchSequence({
      status: 201,
      body: {
        claim_id: "11111111-1111-1111-1111-111111111111",
        agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        verification_code: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
        state: "gist_pending",
        instructions: "...",
      },
    });
    await claimStart({ ...GOOD_START, agent_did: "did:foxbook:01HXYZABCDEFGHJKMNPQRSTVW42" });
    expect((lastRequest?.body as Record<string, unknown>).agent_did).toBe(
      "did:foxbook:01HXYZABCDEFGHJKMNPQRSTVW42",
    );
  });

  it("respects apiBase override (with and without trailing slash)", async () => {
    stubFetchSequence({
      status: 201,
      body: {
        claim_id: "11111111-1111-1111-1111-111111111111",
        agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        verification_code: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
        state: "gist_pending",
        instructions: "...",
      },
    });
    await claimStart({ ...GOOD_START, apiBase: "https://staging.foxbook.dev/" });
    expect(lastRequest?.url).toBe("https://staging.foxbook.dev/api/v1/claim/start");
  });

  it("returns ok on 201", async () => {
    stubFetchSequence({
      status: 201,
      body: {
        claim_id: "11111111-1111-1111-1111-111111111111",
        agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        verification_code: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
        state: "gist_pending",
        instructions: "...",
      },
    });
    const result = await claimStart(GOOD_START);
    expect(result).toEqual({
      status: "ok",
      claim_id: "11111111-1111-1111-1111-111111111111",
      agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      verification_code: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
    });
  });

  it("returns asset-conflict on 409", async () => {
    stubFetchSequence({ status: 409, body: { status: "asset-conflict" } });
    const result = await claimStart(GOOD_START);
    expect(result).toEqual({ status: "asset-conflict" });
  });

  it("returns error on 201 with missing fields", async () => {
    stubFetchSequence({ status: 201, body: { claim_id: "x" } });
    const result = await claimStart(GOOD_START);
    expect(result.status).toBe("error");
  });

  it("returns error on unexpected HTTP code", async () => {
    stubFetchSequence({ status: 500, body: { error: "internal" } });
    const result = await claimStart(GOOD_START);
    if (result.status !== "error") throw new Error("expected error");
    expect(result.reason).toContain("500");
  });

  it("returns error when fetch throws (network failure)", async () => {
    stubFetchThrows("ECONNREFUSED");
    const result = await claimStart(GOOD_START);
    if (result.status !== "error") throw new Error("expected error");
    expect(result.reason).toContain("ECONNREFUSED");
  });

  it("returns error when response is non-JSON", async () => {
    stubFetchNonJson();
    const result = await claimStart(GOOD_START);
    if (result.status !== "error") throw new Error("expected error");
    expect(result.reason).toContain("non-JSON");
  });
});

// ---- claimVerifyGist ----

const VG_INPUT: ClaimVerifyGistInput = {
  claim_id: "11111111-1111-1111-1111-111111111111",
  gist_url: "https://gist.github.com/alice/abc123",
};

describe("claimVerifyGist", () => {
  it("constructs POST /api/v1/claim/verify-gist with correct body", async () => {
    stubFetchSequence({
      status: 200,
      body: { tier: 1, leaf_index: 7, leaf_hash: "f".repeat(64), root_after: "a".repeat(64), sth_jws: "stub.jws" },
    });
    await claimVerifyGist(VG_INPUT);
    expect(lastRequest?.url).toBe("https://api.foxbook.dev/api/v1/claim/verify-gist");
    expect(lastRequest?.body).toEqual({
      claim_id: "11111111-1111-1111-1111-111111111111",
      gist_url: "https://gist.github.com/alice/abc123",
    });
  });

  it("returns tier1-verified with synthesized inclusion_proof_url on 200", async () => {
    stubFetchSequence({
      status: 200,
      body: { tier: 1, leaf_index: 7, leaf_hash: "f".repeat(64), root_after: "a".repeat(64), sth_jws: "stub.jws" },
    });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result).toEqual({
      status: "tier1-verified",
      leaf_index: 7,
      sth_jws: "stub.jws",
      inclusion_proof_url: "https://transparency.foxbook.dev/inclusion/7",
    });
  });

  it("returns still-pending on 200 + status:still-pending", async () => {
    stubFetchSequence({ status: 200, body: { status: "still-pending" } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result).toEqual({ status: "still-pending" });
  });

  it("preserves reason on still-pending when server provides one", async () => {
    stubFetchSequence({ status: 200, body: { status: "still-pending", reason: "code not yet visible" } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result).toEqual({ status: "still-pending", reason: "code not yet visible" });
  });

  it("returns not-found on 200 + status:not-found", async () => {
    stubFetchSequence({ status: 200, body: { status: "not-found", reason: "404 from gist" } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result).toEqual({ status: "not-found", reason: "404 from gist" });
  });

  it("returns error on 200 + status:error", async () => {
    stubFetchSequence({ status: 200, body: { status: "error", reason: "transient" } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result).toEqual({ status: "error", reason: "transient" });
  });

  it("folds 404 (not-found-claim) into not-found", async () => {
    stubFetchSequence({ status: 404, body: { status: "not-found-claim" } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result.status).toBe("not-found");
  });

  it("returns identity-mismatch on 409", async () => {
    stubFetchSequence({
      status: 409,
      body: { status: "identity-mismatch", reason: "gist owner is bob, claim is alice" },
    });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result).toEqual({
      status: "identity-mismatch",
      reason: "gist owner is bob, claim is alice",
    });
  });

  it("folds 400 bad-request into error", async () => {
    stubFetchSequence({ status: 400, body: { status: "bad-request", reason: "claim already verified" } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toContain("claim already verified");
    }
  });

  it("returns error on 200 tier1 missing required fields", async () => {
    stubFetchSequence({ status: 200, body: { tier: 1, leaf_index: 7 } });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result.status).toBe("error");
  });

  it("returns error on network failure", async () => {
    stubFetchThrows("connection reset");
    const result = await claimVerifyGist(VG_INPUT);
    expect(result.status).toBe("error");
  });

  it("returns error on unexpected HTTP code", async () => {
    stubFetchSequence({ status: 503, body: {} });
    const result = await claimVerifyGist(VG_INPUT);
    expect(result.status).toBe("error");
  });
});

// ---- claimRevoke ----

const RV_INPUT: ClaimRevokeInput = {
  claim_id: "11111111-1111-1111-1111-111111111111",
  recovery_key_signature: "eyJhbGciOiJFZERTQSJ9.eyJ9.signature",
};

describe("claimRevoke", () => {
  it("constructs POST /api/v1/claim/revoke + maps recovery_key_signature → revocation_record_jws", async () => {
    stubFetchSequence({
      status: 200,
      body: { revoked: true, leaf_index: 12, leaf_hash: "f".repeat(64), sth_jws: "stub.jws" },
    });
    await claimRevoke(RV_INPUT);
    expect(lastRequest?.url).toBe("https://api.foxbook.dev/api/v1/claim/revoke");
    expect(lastRequest?.body).toEqual({
      claim_id: "11111111-1111-1111-1111-111111111111",
      revocation_record_jws: "eyJhbGciOiJFZERTQSJ9.eyJ9.signature",
    });
  });

  it("returns revoked on 200", async () => {
    stubFetchSequence({
      status: 200,
      body: { revoked: true, leaf_index: 12, leaf_hash: "f".repeat(64), sth_jws: "stub.jws" },
    });
    const result = await claimRevoke(RV_INPUT);
    expect(result).toEqual({
      status: "revoked",
      revocation_leaf_index: 12,
      sth_jws: "stub.jws",
    });
  });

  it("returns not-found on 404", async () => {
    stubFetchSequence({ status: 404, body: { status: "not-found-claim" } });
    const result = await claimRevoke(RV_INPUT);
    expect(result).toEqual({ status: "not-found" });
  });

  it("returns signature-invalid on 403 recovery-key-mismatch", async () => {
    stubFetchSequence({
      status: 403,
      body: { status: "recovery-key-mismatch", reason: "fingerprint mismatch" },
    });
    const result = await claimRevoke(RV_INPUT);
    expect(result).toEqual({
      status: "signature-invalid",
      reason: "fingerprint mismatch",
    });
  });

  it("returns signature-invalid on 403 recovery-key-signature-invalid", async () => {
    stubFetchSequence({
      status: 403,
      body: { status: "recovery-key-signature-invalid", reason: "JWS verify failed" },
    });
    const result = await claimRevoke(RV_INPUT);
    expect(result).toEqual({
      status: "signature-invalid",
      reason: "JWS verify failed",
    });
  });

  it("returns error on 400 bad-state", async () => {
    stubFetchSequence({
      status: 400,
      body: { status: "bad-state", current_state: "gist_pending" },
    });
    const result = await claimRevoke(RV_INPUT);
    expect(result.status).toBe("error");
  });

  it("returns error on 422 invalid-leaf", async () => {
    stubFetchSequence({
      status: 422,
      body: { status: "invalid-leaf", reason: "did mismatch" },
    });
    const result = await claimRevoke(RV_INPUT);
    if (result.status !== "error") throw new Error("expected error");
    expect(result.reason).toContain("did mismatch");
  });

  it("returns error on network failure", async () => {
    stubFetchThrows("DNS lookup failed");
    const result = await claimRevoke(RV_INPUT);
    expect(result.status).toBe("error");
  });

  it("returns error on 200 missing required fields", async () => {
    stubFetchSequence({ status: 200, body: { revoked: true } });
    const result = await claimRevoke(RV_INPUT);
    expect(result.status).toBe("error");
  });
});
