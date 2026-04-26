import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { claims } from "./claims.js";

export const keyPurpose = pgEnum("key_purpose", ["signing", "recovery"]);

/**
 * Ed25519 public keys per agent. The signing key rotates often; the recovery
 * key is held offline by the human owner and signs revocation records. Private
 * key material is never stored in this table — storage is out-of-band (KMS /
 * Cloudflare Workers Secret / user-owned).
 *
 * `claimId` (Day-6 PR B addition) links a key row to the claim that minted it.
 * `ON DELETE SET NULL` per ADR 0004 addendum-1: when a claim is delete-on-
 * revoked, the historical key row stays — its audit trail lives in the Merkle
 * leaf, not the FK. Cascade would erase keys whose history we still want
 * queryable.
 */
export const keys = pgTable("keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  purpose: keyPurpose("purpose").notNull(),
  publicKeyHex: text("public_key_hex").notNull(),
  active: boolean("active").notNull().default(true),
  claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});
