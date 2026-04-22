import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const claimState = pgEnum("claim_state", [
  "unclaimed",
  "gist_pending",
  "tier1_verified",
  "tier2_pending",
  "tier2_verified",
]);

export const claimMethod = pgEnum("claim_method", ["gist", "tweet", "email", "dns", "endpoint"]);

/**
 * Ongoing or completed claim flow per agent. The state machine is documented
 * in docs/foundation/foxbook-foundation.md; v0 captures the minimal fields
 * needed to drive Tier 1 + Tier 2 verification.
 */
export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDid: text("agent_did").notNull(),
  state: claimState("state").notNull().default("unclaimed"),
  method: claimMethod("method"),
  challengeNonce: text("challenge_nonce"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
