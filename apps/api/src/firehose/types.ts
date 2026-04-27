// Firehose wire types.
//
// The listener emits `FirehoseRow` payloads (the JSON projection of one
// firehose_events row, produced server-side by the Migration 0004
// trigger via `row_to_json(NEW)::text`). The SSE route writes them
// onto the wire verbatim.
//
// `payload.event_type` is the discriminator; today's enum (PR D) is
// `claim.verified | revocation.recorded` plus the pre-existing
// `hire.settled | hire.failed | delegation.announced` (filed for the
// week-2+ hire wiring). Per ADR 0003, the Foxbook-specific event_type
// enum lives in schemas/envelope/v1.json — types-ts/types-py
// regenerate from there. We DO NOT redeclare the union here; we
// import from @foxbook/types-ts so any additive bump to the schema
// flows automatically.

import type { FoxbookFirehoseEnvelopeV1 } from "@foxbook/types-ts";

/**
 * Discriminator type — narrows to the schema-regenerated literal union.
 * If a future event_type enum value is added to schemas/envelope/v1.json,
 * `pnpm generate:types` produces a new literal here, and a downstream
 * SSE consumer's exhaustiveness check breaks loudly until handled.
 */
export type FirehoseEventType = FoxbookFirehoseEnvelopeV1["event_type"];

/**
 * The shape of one row produced by `SELECT row_to_json(NEW)` over the
 * firehose_events table. Column → JSON-key naming is snake_case in
 * Postgres regardless of Drizzle's TS-side camelCase aliases, so this
 * type matches what the listener actually receives off the wire.
 *
 * `payload` carries the per-event envelope. Day-7 PR D writes a
 * lightweight shape (event_type + did + leaf_index + leaf_hash +
 * timestamp) under envelope_version "1.0-draft" — the strict-required
 * envelope.v1.json refinement for these new event types is filed for
 * the pre-freeze (PROJECT-PLAN Day 7-9).
 */
export type FirehoseRow = {
  id: string;
  report_id: string;
  envelope_version: string;
  payload: {
    event_type: FirehoseEventType;
    [key: string]: unknown;
  };
  published_at: string;
};

/**
 * Internal in-process emitter event name. Kept here so tests + handlers
 * agree on the string literal without importing each other.
 */
export const FIREHOSE_EVENT = "event" as const;
