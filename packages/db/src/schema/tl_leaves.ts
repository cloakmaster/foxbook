import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Individual Merkle-log leaves. leaf_index is monotonic and gapless.
 * leaf_hash is the canonical sha256 of leaf_data used for inclusion proofs.
 */
export const tlLeaves = pgTable("tl_leaves", {
  leafIndex: bigint("leaf_index", { mode: "bigint" }).primaryKey(),
  leafHash: text("leaf_hash").notNull(),
  leafData: jsonb("leaf_data").notNull(),
  appendedAt: timestamp("appended_at", { withTimezone: true }).notNull().defaultNow(),
});
