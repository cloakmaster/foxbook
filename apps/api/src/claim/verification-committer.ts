// Production wiring for the verify-gist atomic-tx surface (Day-7 PR D).
//
// Mirrors ./revocation-committer.ts shape exactly: one `db.transaction`
// callback containing four LOCAL POSTGRES writes against the SAME
// connection. The advisory lock taken inside `merkle.append` is held
// for the full caller-tx duration; any non-Drizzle await inside the
// callback (`fetch`, adapter call, sleep, external HTTP) would freeze
// every other log writer in the system. Per ADR 0004 addendum-1 +
// addendum-2, the body below is the canonical "fast + local Postgres
// only" pattern. Adding anything else to it requires a follow-on ADR.
//
// Tx body (atomic across all four):
//
//   db.transaction(async (tx) => {
//     1. tx.update(claims) state→tier1_verified, completedAt=now
//     2. tx.insert(keys)   signing key row + claimId FK
//     3. merkle.append(leaf, { tx })   advisory-lock + tl_leaves +
//                                       transparency_log inserts
//     4. tx.insert(firehose_events)    PR D fanout seed
//   })
//
// Closes the Day-5 non-atomicity gap where the three writes ran as
// independent operations: a crash between leaf append and operational
// state writes left the Merkle log claiming "tier1" while Postgres
// disagreed. Atomic across the four eliminates that window.

import {
  type MerkleAppendResult,
  type MerkleRepository,
  type NodeDbClient,
  schema,
} from "@foxbook/db";
import { eq } from "drizzle-orm";

import type { VerificationCommitter } from "./types.js";

/**
 * Build the production verification committer. Captures `db` + `merkle`
 * in a closure so callers don't have to re-thread them through deps;
 * tests use a hand-rolled vi.fn fake instead.
 */
export function createVerificationCommitter(
  db: NodeDbClient,
  merkle: MerkleRepository,
): VerificationCommitter {
  return async ({ claim, leafPayload }) => {
    return await db.transaction(async (tx): Promise<MerkleAppendResult> => {
      // 1. Mark claim tier1_verified.
      await tx
        .update(schema.claims)
        .set({ state: "tier1_verified", completedAt: new Date() })
        .where(eq(schema.claims.id, claim.id));

      // 2. Insert signing key row. claim_id FK ON DELETE SET NULL per
      //    ADR 0004 addendum-1: if the claim is later delete-on-revoked,
      //    the historical key row stays so its audit trail through the
      //    Merkle leaf remains queryable.
      await tx.insert(schema.keys).values({
        agentDid: claim.agentDid,
        purpose: "signing",
        publicKeyHex: claim.ed25519PublicKeyHex,
        active: true,
        claimId: claim.id,
      });

      // 3. Merkle append participating in caller's tx (advisory lock
      //    held until our COMMIT, leaf + STH inserts atomic with the
      //    other three writes).
      const result = await merkle.append(leafPayload, { tx });

      // 4. ADR 0004 addendum-2: caller-side firehose emission. The
      //    payload jsonb carries the claim.verified envelope shape;
      //    Migration 0004's AFTER INSERT trigger pg_notify's the row
      //    on commit.
      await tx.insert(schema.firehoseEvents).values({
        reportId: result.leafIndex.toString(),
        envelopeVersion: "1.0-draft",
        payload: {
          event_type: "claim.verified",
          did: claim.agentDid,
          asset_type: claim.assetType,
          asset_value: claim.assetValue,
          tier: 1,
          leaf_index: result.leafIndex,
          leaf_hash: result.leafHash,
          timestamp: result.publishedAt.toISOString(),
        },
      });

      return result;
    });
  };
}
