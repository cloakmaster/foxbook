import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Completed verification proofs. One row per (agent, tier) reached.
 * Evidence URL + hash preserve provenance so Tier demotions are auditable.
 */
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  tier: integer("tier").notNull(),
  method: text("method").notNull(),
  evidenceUrl: text("evidence_url"),
  evidenceHash: text("evidence_hash"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
});
