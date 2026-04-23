import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const claimState = pgEnum("claim_state", [
  "unclaimed",
  "gist_pending",
  "tier1_verified",
  "tier2_pending",
  "tier2_verified",
]);

export const claimMethod = pgEnum("claim_method", ["gist", "tweet", "email", "dns", "endpoint"]);

export const assetType = pgEnum("asset_type", ["github_handle", "x_handle", "domain"]);

/**
 * Ongoing or completed claim flow per agent. The state machine is documented
 * in docs/foundation/foxbook-foundation.md.
 *
 * Day-5 additions (asset_type / asset_value / ed25519_public_key_hex /
 * recovery_key_fingerprint / verification_code) back the Tier-1 via Gist
 * flow. All four are nullable so the additive migration doesn't break
 * hypothetical pre-v0 rows; the partial unique index below enforces
 * one claim per verified asset once they're populated, preventing the
 * "Bob claims @alice" race.
 *
 * V1 simplification: one claim per asset. Multiple agents under the
 * same verified owner asset is a later-week extension (requires
 * separating asset-verification rows from agent-registration rows).
 *
 * Partial UNIQUE predicate (pinned — Day-5 completion pass):
 * `WHERE asset_type IS NOT NULL AND asset_value IS NOT NULL`. The
 * predicate is scoped this narrowly DELIBERATELY for v0: (a) legacy
 * claims rows from before the Day-5 migration have nullable asset
 * fields and must not trigger uniqueness, and (b) state-based
 * exclusions (e.g. letting a revoked claim release its asset) are
 * NOT encoded yet. Once revocation lands (Day 6), Migration 0003
 * MUST either extend the predicate to `AND state != 'revoked'` OR
 * delete-on-revoke — not BOTH. Until then, a claim in any state
 * (gist_pending / tier1_verified / etc.) holds the asset. Future-you:
 * do not silently change the predicate without an ADR; the
 * uniqueness invariant changed.
 */
export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentDid: text("agent_did").notNull(),
    state: claimState("state").notNull().default("unclaimed"),
    method: claimMethod("method"),
    challengeNonce: text("challenge_nonce"),
    assetType: assetType("asset_type"),
    assetValue: text("asset_value"),
    ed25519PublicKeyHex: text("ed25519_public_key_hex"),
    recoveryKeyFingerprint: text("recovery_key_fingerprint"),
    verificationCode: text("verification_code"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("claims_asset_uniq_idx")
      .on(t.assetType, t.assetValue)
      .where(sql`${t.assetType} IS NOT NULL AND ${t.assetValue} IS NOT NULL`),
  ],
);
