import { type DbClient, schema } from "@foxbook/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DiscoverQuery } from "./query-schema.js";
import type { AgentRow, DiscoveryRepository } from "./types.js";

/**
 * Postgres-backed repository. Reads `agents` + `manifests_versions` and leaves
 * ranking as a stub (tier desc, created_at desc) until Meilisearch lands in
 * week 2. Capability filter uses a jsonb containment check against the
 * manifest's `capabilities` array.
 */
export class DrizzleDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly db: DbClient) {}

  async findAgents(query: DiscoverQuery): Promise<{ rows: AgentRow[]; totalMatching: number }> {
    const { agents, manifestsVersions } = schema;

    const conditions = [eq(agents.claimed, true)];
    if (query.tier !== undefined) {
      conditions.push(gte(agents.verificationTier, query.tier));
    }
    // Capability filter: manifest.content->'capabilities' ⊇ [capability].
    // Uses a parameterised jsonb @> operator; value is a single-element JSON array.
    const capabilityJson = JSON.stringify([query.capability]);
    conditions.push(sql`${manifestsVersions.content}->'capabilities' @> ${capabilityJson}::jsonb`);

    const whereClause = and(...conditions);

    const base = this.db
      .select({
        did: agents.did,
        url: agents.url,
        verificationTier: agents.verificationTier,
        manifestContent: manifestsVersions.content,
        agentCardUrl: sql<string | null>`${manifestsVersions.content}->>'agent_card_url'`,
      })
      .from(agents)
      .leftJoin(manifestsVersions, eq(agents.currentManifestVersionId, manifestsVersions.id))
      .where(whereClause);

    const rowsRaw = await base
      .orderBy(desc(agents.verificationTier), desc(agents.createdAt))
      .limit(query.limit);

    const countRows = await this.db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(agents)
      .leftJoin(manifestsVersions, eq(agents.currentManifestVersionId, manifestsVersions.id))
      .where(whereClause);

    return {
      rows: rowsRaw.map<AgentRow>((r) => ({
        did: r.did,
        url: r.url,
        verificationTier: r.verificationTier,
        manifestContent: (r.manifestContent as Record<string, unknown> | null) ?? null,
        manifestUrl: r.agentCardUrl ?? null,
      })),
      totalMatching: countRows[0]?.n ?? 0,
    };
  }
}
