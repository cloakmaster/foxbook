-- Migration 0004: firehose_events INSERT trigger emitting pg_notify('foxbook_firehose').
--
-- Hand-authored: Drizzle's schema model does not represent triggers, so
-- `drizzle-kit generate` produces nothing here. The 0004_snapshot.json
-- mirrors 0003 byte-for-byte (modulo the rotated id/prevId) so the next
-- drizzle-kit generate diffs cleanly.
--
-- Wire shape: pg_notify payload = row_to_json(NEW)::text. apps/api's
-- firehose listener subscribes via `LISTEN foxbook_firehose` over a
-- non-pooled connection (DATABASE_URL_DIRECT) and JSON.parse's the
-- payload onto an in-process EventEmitter, which the GET /firehose SSE
-- handler tails to clients.
--
-- Row-size discipline (ADR 0004 addendum-2): firehose_events.payload
-- jsonb is restricted to <1 KB serialized so `row_to_json(NEW)::text`
-- stays comfortably under pg_notify's 8 KB hard cap. If a future event
-- type breaches that, the trigger is changed to emit only
--   {event_id: NEW.id, event_type: NEW.payload->>'event_type'}
-- and the listener does an out-of-band SELECT to fetch the full row
-- before SSE-fanning. Fallback documented to make the future change
-- mechanical.
--
-- ADR cross-refs:
--   * ADR 0002 — forward-only migrations (this is additive: trigger +
--     function only, no column changes, idempotent against existing rows).
--   * ADR 0004 addendum-2 — caller-side firehose emission (this trigger
--     is the OUTBOUND fanout half; the INBOUND insert lives in the
--     verification-committer / revocation-committer tx bodies).

CREATE FUNCTION firehose_events_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('foxbook_firehose', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER firehose_events_notify_tr
  AFTER INSERT ON firehose_events
  FOR EACH ROW EXECUTE FUNCTION firehose_events_notify();
