import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const reportEventType = pgEnum("report_event_type", [
  "hire.settled",
  "hire.failed",
  "delegation.announced",
]);

/**
 * Hire / settlement reports. One row per agent-to-agent event. The `envelope`
 * column holds the full firehose v1 envelope; `envelope_hash` is the sha256
 * of its canonical serialisation and is what goes into the transparency log.
 */
export const reports = pgTable("reports", {
  // event_id is the external ULID-prefixed id (fbx_{ulid}), also the PK for
  // idempotent writes from adapters/scouts.
  id: text("id").primaryKey(),
  eventType: reportEventType("event_type").notNull(),
  hirerDid: text("hirer_did").notNull(),
  hireeDid: text("hiree_did").notNull(),
  envelope: jsonb("envelope").notNull(),
  envelopeHash: text("envelope_hash").notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});
