import type { DiscoverQuery } from "./query-schema.js";

/**
 * One row's worth of agent data the repository hands to the handler.
 * Intentionally flat + minimal — the handler is the only place that
 * reshapes into the foundation §7.1 response envelope.
 */
export type AgentRow = {
  did: string;
  url: string;
  verificationTier: number;
  // The manifest jsonb is opaque at this boundary; handler extracts
  // capabilities / pricing / endpoint from it.
  manifestContent: Record<string, unknown> | null;
  manifestUrl: string | null;
};

/**
 * DiscoveryRepository — the only DB-facing surface the handler touches.
 * Production impl is `DrizzleDiscoveryRepository`; tests provide a fake.
 * Keeping the interface thin lets us swap the backend (Meilisearch in
 * week 2) without touching handler code or tests.
 */
export interface DiscoveryRepository {
  findAgents(query: DiscoverQuery): Promise<{ rows: AgentRow[]; totalMatching: number }>;
}
