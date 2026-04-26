// Production wiring for the revocation atomic-tx surface. Runs:
//
//   db.transaction(async (tx) => {
//     merkle.append(fullLeaf, { tx })   // advisory-lock + leaf insert + STH
//     tx.insert(firehose_events) ...    // PR D fanout seed (ADR 0004 add-2)
//     tx.delete(claims) where id = ...  // delete-on-revoke (ADR 0004 add-1)
//   })
//
// Every step runs against the SAME pg connection (postgres-js client.transaction
// pins one connection for the callback's lifetime). The advisory lock taken
// inside merkle.append is held until our COMMIT, so any slow operation here
// would serialise every other log-write in the system. The body below is
// the canonical "fast + local Postgres only" pattern — DO NOT add fetch /
// external adapter calls / sleeps / non-Drizzle awaits. ADR 0004 addendum-2
// names the ratified single exception (the firehose_events insert below).

import { type MerkleRepository, type NodeDbClient, schema } from "@foxbook/db";
import { eq } from "drizzle-orm";

import type { RevocationCommitter } from "./types.js";

/**
 * Build the production revocation committer. Captures `db` + `merkle` in a
 * closure so callers don't have to re-thread them through deps; tests use
 * a hand-rolled fake (vi.fn) instead.
 */
export function createRevocationCommitter(
  db: NodeDbClient,
  merkle: MerkleRepository,
): RevocationCommitter {
  return async ({ claim, fullLeaf }) => {
    return await db.transaction(async (tx) => {
      const result = await merkle.append(fullLeaf, { tx });

      // ADR 0004 addendum-2 ratified caller-side firehose emission. The
      // current firehose_events schema (Day-5 v0) wraps the event in
      // payload jsonb; PR D may redesign the columns, but this insert
      // is forward-compatible — the payload preserves the envelope shape.
      await tx.insert(schema.firehoseEvents).values({
        reportId: result.leafIndex.toString(),
        envelopeVersion: "1.0-draft",
        payload: {
          event_type: "revocation.recorded",
          did: claim.agentDid,
          leaf_index: result.leafIndex,
          leaf_hash: result.leafHash,
          timestamp: result.publishedAt.toISOString(),
          hash: result.leafHash,
        },
      });

      await tx.delete(schema.claims).where(eq(schema.claims.id, claim.id));

      return result;
    });
  };
}
