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
        // postgres-js surfaces the SQLSTATE on the error object's `code`.
        if (
          e &&
          typeof e === "object" &&
          "code" in e &&
          (e as { code: string }).code === UNIQUE_VIOLATION_CODE
        ) {
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

    async markTier1Verified(id) {
      await db
        .update(schema.claims)
        .set({ state: "tier1_verified", completedAt: new Date() })
        .where(eq(schema.claims.id, id));
    },

    async insertSigningKey(agentDid, publicKeyHex) {
      await db.insert(schema.keys).values({
        agentDid,
        purpose: "signing",
        publicKeyHex,
        active: true,
      });
    },
  };
}
