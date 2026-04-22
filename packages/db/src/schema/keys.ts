import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const keyPurpose = pgEnum("key_purpose", ["signing", "recovery"]);

/**
 * Ed25519 public keys per agent. The signing key rotates often; the recovery
 * key is held offline by the human owner and signs revocation records. Private
 * key material is never stored in this table — storage is out-of-band (KMS /
 * Cloudflare Workers Secret / user-owned).
 */
export const keys = pgTable("keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  purpose: keyPurpose("purpose").notNull(),
  publicKeyHex: text("public_key_hex").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
