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
      markTier1Verified: async () => {},
      insertSigningKey: async () => {},
    },
    gist: { verifyGistContainsCode: async () => ({ status: "error" }) },
    merkle: {
      append: async () => {
        throw new Error("discover tests never call merkle.append");
      },
    },
  };
}

function makeApp(repo: DiscoveryRepository = emptyRepo()) {
  return createApp({ discoveryRepo: repo, claim: stubClaimDeps() });
}

describe("GET /api/v1/discover — route", () => {
  it("returns 200 + §7.1 envelope for the happy path", async () => {
    const app = makeApp();
    const res = await app.request("/api/v1/discover?capability=text-summarization");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.schema_version).toBe("1.0-draft");
    expect(body.results).toEqual([]);
    expect(body.total_matching).toBe(0);
    expect((body.query as { capability: string }).capability).toBe("text-summarization");
  });

  it("returns 400 when `capability` is missing", async () => {
    const app = makeApp();
    const res = await app.request("/api/v1/discover");
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid payment_rail enum", async () => {
    const app = makeApp();
    const res = await app.request("/api/v1/discover?capability=x&payment_rail=bitcoin");
    expect(res.status).toBe(400);
  });

  it("returns 400 when tier is outside 0-4", async () => {
    const app = makeApp();
    const res = await app.request("/api/v1/discover?capability=x&tier=7");
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit exceeds 50", async () => {
    const app = makeApp();
    const res = await app.request("/api/v1/discover?capability=x&limit=999");
    expect(res.status).toBe(400);
  });

  it("applies the default limit=10 when omitted", async () => {
    const app = makeApp();
    const res = await app.request("/api/v1/discover?capability=x");
    const body = (await res.json()) as { query: { limit: number } };
    expect(body.query.limit).toBe(10);
  });

  it("coerces numeric query params from their string form", async () => {
    const app = makeApp();
    const res = await app.request(
      "/api/v1/discover?capability=x&tier=3&latency_max_ms=250&limit=20",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { query: Record<string, unknown> };
    expect(body.query).toMatchObject({ tier: 3, latency_max_ms: 250, limit: 20 });
  });

  it("responds 200 on /health", async () => {
    const app = makeApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, service: "foxbook-api" });
  });
});
