import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Canonical agent record. Keyed by did:foxbook:{ulid}; the human URL
 * (foxbook.dev/@owner/slug) is an alias. Class vs. Instance: when
 * class_did is set, this row is an Instance of another (Class) agent.
 */
export const agents = pgTable("agents", {
  did: text("did").primaryKey(),
  url: text("url").notNull().unique(),
  ownerHandle: text("owner_handle").notNull(),
  slug: text("slug").notNull(),
  classDid: text("class_did"),
  verificationTier: integer("verification_tier").notNull().default(0),
  claimed: boolean("claimed").notNull().default(false),
  currentManifestVersionId: uuid("current_manifest_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
