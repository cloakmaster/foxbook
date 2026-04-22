import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Merkle transparency log roots (STHs — signed tree heads). Each row is a
 * published root attesting to the first `leaf_count` entries in tl_leaves.
 * Publicly browsable at transparency.foxbook.dev.
 */
export const transparencyLog = pgTable("transparency_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  logId: text("log_id").notNull().default("foxbook-v1"),
  rootHash: text("root_hash").notNull(),
  leafCount: bigint("leaf_count", { mode: "bigint" }).notNull(),
  signedTreeHead: text("signed_tree_head").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});
