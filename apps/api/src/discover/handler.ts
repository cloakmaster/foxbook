import type { FoxbookDiscoveryAPIResponseV1 as DiscoverResponse } from "@foxbook/types-ts";
import type { DiscoverQuery } from "./query-schema.js";
import type { AgentRow, DiscoveryRepository } from "./types.js";

/**
 * Pure handler: takes a validated query + an injected repository, returns
 * the §7.1-shaped response envelope. No framework dependencies. Tests
 * pass a fake repository; production wiring lives in route.ts + server.ts.
 */
export async function discover(
  query: DiscoverQuery,
  repo: DiscoveryRepository,
): Promise<DiscoverResponse> {
  const start = Date.now();
  const { rows, totalMatching } = await repo.findAgents(query);
  const results = rows.map((r) => toResult(r));
  return {
    schema_version: "1.0-draft",
    query: {
      capability: query.capability,
      sub: query.sub ?? null,
      tier: query.tier ?? null,
      budget_max_usd: query.budget_max_usd ?? null,
      latency_max_ms: query.latency_max_ms ?? null,
      payment_rail: query.payment_rail ?? null,
      limit: query.limit,
    },
    results,
    total_matching: totalMatching,
    query_time_ms: Date.now() - start,
  };
}

function toResult(row: AgentRow): DiscoverResponse["results"][number] {
  const manifest = row.manifestContent ?? {};
  const capabilities = extractCapabilities(manifest);
  const pricing = extractPricingHint(manifest);
  const endpoint =
    typeof (manifest as { url?: unknown }).url === "string"
      ? (manifest as { url: string }).url
      : null;
  return {
    did: row.did,
    url: row.url,
    tier: row.verificationTier,
    capabilities,
    // v0 has no data source for these — contract says null / []
    reputation: null,
    pricing_hint: pricing,
    latency_p50_ms: null,
    uptime_30d: null,
    brain_health: null,
    endpoint,
    agent_card_url: row.manifestUrl,
    sample_work: [],
  };
}

function extractCapabilities(manifest: Record<string, unknown>): string[] {
  const raw = (manifest as { capabilities?: unknown }).capabilities;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function extractPricingHint(
  manifest: Record<string, unknown>,
): DiscoverResponse["results"][number]["pricing_hint"] {
  const xfb = (manifest as { "x-foxbook"?: unknown })["x-foxbook"];
  if (!xfb || typeof xfb !== "object") return null;
  const pricing = (xfb as { pricing?: unknown }).pricing;
  if (!pricing || typeof pricing !== "object") return null;
  const p = pricing as Record<string, unknown>;
  if (
    (p.rail === "x402" || p.rail === "ap2" || p.rail === "mpp") &&
    typeof p.amount_usd === "string" &&
    typeof p.unit === "string"
  ) {
    return { rail: p.rail, amount_usd: p.amount_usd, unit: p.unit };
  }
  return null;
}
