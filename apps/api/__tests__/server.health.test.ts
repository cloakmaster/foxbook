import { EventEmitter } from "node:events";

import type { MerkleRepository, MerkleRootSnapshot } from "@foxbook/db";
import { describe, expect, it } from "vitest";

import type { ClaimDeps } from "../src/claim/handlers.js";
import type { DiscoveryRepository } from "../src/discover/types.js";
import { createApp } from "../src/server.js";

function emptyRepo(): DiscoveryRepository {
  return {
    async findAgents() {
      return { rows: [], totalMatching: 0 };
    },
  };
}

function stubClaimDeps(): ClaimDeps {
  return {
    claimRepo: {
      insertClaim: async () => ({ ok: true, id: "stub" }),
      findById: async () => null,
      markTier2Verified: async () => {},
    },
    gist: { verifyGistContainsCode: async () => ({ status: "error" }) },
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

function fakeMerkleRepo(snapshot: MerkleRootSnapshot | null): MerkleRepository {
  return {
    append: async () => {
      throw new Error("not called");
    },
    getRoot: async () => snapshot,
    getLeaf: async () => null,
    getInclusionProof: async () => {
      throw new Error("not called");
    },
    getConsistencyProof: async () => {
      throw new Error("not called");
    },
  };
}

function makeApp(opts: {
  merkleRepo?: MerkleRepository;
  logSigningPublicKeyHex?: string;
} = {}) {
  return createApp({
    discoveryRepo: emptyRepo(),
    claim: stubClaimDeps(),
    firehoseEmitter: new EventEmitter(),
    merkleRepo: opts.merkleRepo,
    logSigningPublicKeyHex: opts.logSigningPublicKeyHex,
  });
}

describe("GET /healthz", () => {
  it("returns 200 + status:ok + leafCount=0 when merkleRepo is omitted", async () => {
    const app = makeApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("foxbook-api");
    expect(body.leafCount).toBe(0);
    expect(typeof body.uptime_seconds).toBe("number");
    expect(body.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it("returns leafCount from merkleRepo.getRoot()", async () => {
    const snapshot: MerkleRootSnapshot = {
      leafCount: 7,
      rootHash: "cc86626325eb8a9d000000000000000000000000000000000000000000000000",
      sthJws: "stub-jws",
      publishedAt: new Date("2026-04-30T00:00:00Z"),
    };
    const app = makeApp({ merkleRepo: fakeMerkleRepo(snapshot) });
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.leafCount).toBe(7);
  });

  it("returns 0 when merkleRepo.getRoot() returns null (empty log)", async () => {
    const app = makeApp({ merkleRepo: fakeMerkleRepo(null) });
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.leafCount).toBe(0);
  });

  it("returns 503 + status:degraded when merkleRepo.getRoot() throws", async () => {
    const erroringRepo: MerkleRepository = {
      append: async () => {
        throw new Error("not called");
      },
      getRoot: async () => {
        throw new Error("DB unreachable");
      },
      getLeaf: async () => null,
      getInclusionProof: async () => {
        throw new Error("not called");
      },
      getConsistencyProof: async () => {
        throw new Error("not called");
      },
    };
    const app = makeApp({ merkleRepo: erroringRepo });
    const res = await app.request("/healthz");
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("degraded");
    expect(body.leafCount).toBe(0);
  });
});

describe("GET /.well-known/foxbook.json", () => {
  it("returns 200 + protocol-discovery shape", async () => {
    const app = makeApp();
    const res = await app.request("/.well-known/foxbook.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.protocol_version).toBe("1.0");
    expect(body.supported_tiers).toEqual([1]);
    expect(body.transparency_log_url).toBe("https://transparency.foxbook.dev");
    expect(body.api_base).toBe("https://api.foxbook.dev");
    // public key field omitted when not configured
    expect(body.log_signing_public_key_hex).toBeUndefined();
  });

  it("includes log_signing_public_key_hex when configured", async () => {
    const pubHex = "f".repeat(64);
    const app = makeApp({ logSigningPublicKeyHex: pubHex });
    const res = await app.request("/.well-known/foxbook.json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.log_signing_public_key_hex).toBe(pubHex);
  });
});
