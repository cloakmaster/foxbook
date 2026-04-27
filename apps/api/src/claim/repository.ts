// Drizzle-backed ClaimRepository. Translates between the plain-object
// ClaimRow type the handlers consume and the Drizzle schema.
//
// Concurrency: insertClaim catches Postgres's unique-violation on the
// partial unique index (claims_asset_uniq_idx) and returns
// {ok: false, status: "asset-conflict"}. The partial index only
// enforces uniqueness on rows where asset_type + asset_value are both
// non-null (the post-Day-5 flow always populates both).

import type { NodeDbClient } from "@foxbook/db";
import { schema } from "@foxbook/db";
import { eq } from "drizzle-orm";

import type { AssetType, ClaimRepository, ClaimRow, ClaimState } from "./types.js";

const UNIQUE_VIOLATION_CODE = "23505";

// Drizzle (>= 0.44) wraps query errors in DrizzleQueryError with the
// original postgres-js error in `cause`. Older versions surfaced the
// SQLSTATE on the top-level error. Walk the cause chain so both forms
// translate to a clean asset-conflict instead of a 500.
export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let depth = 0; depth < 4; depth++) {
    if (
      cur &&
      typeof cur === "object" &&
      "code" in cur &&
      (cur as { code: unknown }).code === UNIQUE_VIOLATION_CODE
    ) {
      return true;
    }
    if (cur && typeof cur === "object" && "cause" in cur) {
      cur = (cur as { cause: unknown }).cause;
      continue;
    }
    return false;
  }
  return false;
}

function rowToClaim(r: typeof schema.claims.$inferSelect): ClaimRow {
  // The Day-5 flow populates every nullable column; rows in other
  // states may not have them. We narrow only when we know they're
  // present (i.e. on findById of a Day-5 claim).
  return {
    id: r.id,
    agentDid: r.agentDid,
    state: r.state as ClaimState,
    assetType: r.assetType as AssetType,
    assetValue: r.assetValue ?? "",
    ed25519PublicKeyHex: r.ed25519PublicKeyHex ?? "",
    recoveryKeyFingerprint: r.recoveryKeyFingerprint ?? "",
    verificationCode: r.verificationCode ?? "",
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  };
}

export function createClaimRepository(db: NodeDbClient): ClaimRepository {
  return {
    async insertClaim(row) {
      try {
        const inserted = await db
          .insert(schema.claims)
          .values({
            agentDid: row.agentDid,
            state: row.state,
            method: "gist",
            assetType: row.assetType,
            assetValue: row.assetValue,
            ed25519PublicKeyHex: row.ed25519PublicKeyHex,
            recoveryKeyFingerprint: row.recoveryKeyFingerprint,
            verificationCode: row.verificationCode,
          })
          .returning({ id: schema.claims.id });
        const id = inserted[0]?.id;
        if (!id) throw new Error("insertClaim: RETURNING produced no row");
        return { ok: true, id };
      } catch (e) {
        if (isUniqueViolation(e)) {
          return { ok: false, status: "asset-conflict" };
        }
        throw e;
      }
    },

    async findById(id) {
      const rows = await db.select().from(schema.claims).where(eq(schema.claims.id, id)).limit(1);
      if (rows.length === 0) return null;
      return rowToClaim(rows[0]!);
    },

    // Day-7 PR D removed `markTier1Verified` and `insertSigningKey`:
    // those writes now live inside the verify-gist atomic-tx body
    // (verification-committer.ts), which calls tx.update + tx.insert
    // directly against Drizzle's tx handle.

    async markTier2Verified(id) {
      // Day-7 PR C — Tier 2 transition. App-state-only today (no
      // Merkle leaf); see PR C body's security-model asymmetry note +
      // tier-upgrade $defs filed for v1.1.
      await db
        .update(schema.claims)
        .set({ state: "tier2_verified", completedAt: new Date() })
        .where(eq(schema.claims.id, id));
    },
  };
}
