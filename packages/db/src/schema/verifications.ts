import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { claims } from "./claims.js";

/**
 * Completed verification proofs. One row per (agent, tier) reached.
 * Evidence URL + hash preserve provenance so Tier demotions are auditable.
 *
 * `claimId` (Day-6 PR B addition) links the verification to the claim that
 * triggered it. `ON DELETE SET NULL` per ADR 0004 addendum-1: a delete-on-
 * revoked claim leaves the historical verification row standing — same
 * rationale as keys.claim_id. Cascade would erase tier-progression history
 * that scouts may still want to inspect.
 */
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  tier: integer("tier").notNull(),
  method: text("method").notNull(),
  evidenceUrl: text("evidence_url"),
  evidenceHash: text("evidence_hash"),
  claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
});
