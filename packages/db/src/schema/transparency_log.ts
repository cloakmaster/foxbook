import { bigint, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Merkle transparency log roots (STHs — signed tree heads). Each row is a
 * published root attesting to the first `leaf_count` entries in tl_leaves.
 * Publicly browsable at transparency.foxbook.dev.
 *
 * `right_edge` caches the RFC 9162 right-edge state (an array of
 * complete-subtree {hash, height} entries, popcount(leaf_count) deep)
 * so `appendLeaf` can run in O(log n) per call without re-reading
 * prior leaves. See core/src/merkle/tree.ts for the math and docs/
 * decisions/0002-db-layer-discipline.md for the additive-migration
 * rule this column follows. Nullable so the STH produced by an
 * external tool (or pre-migration rows, of which there are none
 * today) doesn't require the cache.
 */
export const transparencyLog = pgTable("transparency_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  logId: text("log_id").notNull().default("foxbook-v1"),
  rootHash: text("root_hash").notNull(),
  leafCount: bigint("leaf_count", { mode: "bigint" }).notNull(),
  signedTreeHead: text("signed_tree_head").notNull(),
  rightEdge: jsonb("right_edge"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});
