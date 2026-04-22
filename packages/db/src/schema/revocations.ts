import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Revocation records, each signed by the agent's recovery key and anchored
 * in the transparency log via merkle_leaf_hash. All post-revocation
 * signatures by the revoked key are rejected.
 */
export const revocations = pgTable("revocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  revokedKeyId: uuid("revoked_key_id").notNull(),
  recoverySignature: text("recovery_signature").notNull(),
  merkleLeafHash: text("merkle_leaf_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
