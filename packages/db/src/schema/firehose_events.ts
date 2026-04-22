import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Firehose fan-out queue. Writes land here after a report finishes settling
 * server-side; Cloudflare Durable Objects read from here to push to
 * /live subscribers. published_at - reported_at (from reports) feeds the
 * p95 staleness SLO.
 */
export const firehoseEvents = pgTable("firehose_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: text("report_id").notNull(),
  envelopeVersion: text("envelope_version").notNull(),
  payload: jsonb("payload").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
});
