import { describe, expect, it } from "vitest";
import { discover } from "../src/discover/handler.js";
import type { DiscoverQuery } from "../src/discover/query-schema.js";
import type { AgentRow, DiscoveryRepository } from "../src/discover/types.js";

function fakeRepo(rows: AgentRow[], totalMatching: number = rows.length): DiscoveryRepository {
  return {
    async findAgents() {
      return { rows, totalMatching };
    },
  };
}

const minimalQuery: DiscoverQuery = { capability: "text-summarization", limit: 10 };

describe("discover handler — response envelope", () => {
  it("returns the §7.1 shape with empty results when the repo has nothing", async () => {
    const res = await discover(minimalQuery, fakeRepo([]));

    expect(res).toMatchObject({
      schema_version: "1.0-draft",
      query: {
        capability: "text-summarization",
        sub: null,
        tier: null,
        budget_max_usd: null,
        latency_max_ms: null,
        payment_rail: null,
        limit: 10,
      },
      results: [],
      total_matching: 0,
    });
    expect(typeof res.query_time_ms).toBe("number");
    expect(res.query_time_ms).toBeGreaterThanOrEqual(0);
  });

  it("echoes optional query params into `query` verbatim", async () => {
    const q: DiscoverQuery = {
      capability: "language-translation",
      sub: "japanese-to-english",
      tier: 2,
      budget_max_usd: "0.01",
      latency_max_ms: 500,
      payment_rail: "x402",
      limit: 25,
    };
    const res = await discover(q, fakeRepo([]));
    expect(res.query).toEqual({
      capability: "language-translation",
      sub: "japanese-to-english",
      tier: 2,
      budget_max_usd: "0.01",
      latency_max_ms: 500,
      payment_rail: "x402",
      limit: 25,
    });
  });
});

describe("discover handler — result projection", () => {
  it("maps agent rows to §7.1 DiscoveryResult with null/empty for v0-missing fields", async () => {
    const row: AgentRow = {
      did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      url: "foxbook.dev/@translator/ja-en",
      verificationTier: 2,
      manifestContent: {
        capabilities: ["language-translation:japanese-to-english"],
        url: "https://translator.example.com/a2a",
        "x-foxbook": {
          pricing: { rail: "x402", amount_usd: "0.003", unit: "1K tokens" },
        },
      },
      manifestUrl: "https://foxbook.dev/@translator/ja-en/agent-card.json",
    };

    const res = await discover(minimalQuery, fakeRepo([row], 47));
    expect(res.total_matching).toBe(47);
    expect(res.results).toHaveLength(1);
    const r = res.results[0]!;
    expect(r).toEqual({
      did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
      url: "foxbook.dev/@translator/ja-en",
      tier: 2,
      capabilities: ["language-translation:japanese-to-english"],
      reputation: null,
      pricing_hint: { rail: "x402", amount_usd: "0.003", unit: "1K tokens" },
      latency_p50_ms: null,
      uptime_30d: null,
      brain_health: null,
      endpoint: "https://translator.example.com/a2a",
      agent_card_url: "https://foxbook.dev/@translator/ja-en/agent-card.json",
      sample_work: [],
    });
  });

  it("handles manifest-less agents (shadow URLs) — emits null / [] for missing data", async () => {
    const row: AgentRow = {
      did: "did:foxbook:01HXXXXXXXXXXXXXXXXXXXXXXX",
      url: "foxbook.dev/@shadow/nothing-here",
      verificationTier: 0,
      manifestContent: null,
      manifestUrl: null,
    };
    const res = await discover(minimalQuery, fakeRepo([row]));
    const r = res.results[0]!;
    expect(r.capabilities).toEqual([]);
    expect(r.pricing_hint).toBeNull();
    expect(r.endpoint).toBeNull();
    expect(r.agent_card_url).toBeNull();
    expect(r.sample_work).toEqual([]);
    expect(r.tier).toBe(0);
  });

  it("drops pricing_hint if the manifest declares a non-allowed rail", async () => {
    const row: AgentRow = {
      did: "did:foxbook:01HABCDEFGHJKMNPQRSTVWXYZ1",
      url: "foxbook.dev/@rogue/agent",
      verificationTier: 1,
      manifestContent: {
        capabilities: ["text-summarization"],
        "x-foxbook": { pricing: { rail: "bitcoin", amount_usd: "0.01", unit: "call" } },
      },
      manifestUrl: null,
    };
    const res = await discover(minimalQuery, fakeRepo([row]));
    expect(res.results[0]?.pricing_hint).toBeNull();
  });
});
