import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Immutable manifest versions. Each row is a signed A2A AgentCard (with
 * x-foxbook extensions) snapshotted at a monotonic version_number. Reputation
 * binds to content_hash per the version-scoped reputation rule.
 */
export const manifestsVersions = pgTable("manifests_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  versionNumber: integer("version_number").notNull(),
  content: jsonb("content").notNull(),
  contentHash: text("content_hash").notNull(),
  signedByKeyId: uuid("signed_by_key_id").notNull(),
  signature: text("signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
