// Integration test for the verify-gist atomic-tx (PR D).
//
// Proves that all FOUR writes from createVerificationCommitter — claim
// state update, signing-key insert, merkle.append, firehose_events
// insert — happen inside ONE db.transaction. A thrown error mid-
// callback rolls back all four; a clean exit commits all four.
//
// Without this test, the "atomic across the four" claim from PR D's
// design is unverified. The merkle-repository.tx-context test proves
// the lower-level (caller's tx → merkle.append({tx})) contract; this
// test proves the verification-committer specifically honours it.
//
// **GATED**: runs only with RUN_INTEGRATION_TESTS=1 (live Postgres
// against dev). Mirrors the merkle-repository.tx-context.test.ts
// pattern.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { generateKeypair, keypairFromSeed, sha256Hex } from "@foxbook/core";
import {
  createMerkleRepository,
  createNodeClient,
  type MerkleRepository,
  schema,
} from "@foxbook/db";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ClaimRow } from "../src/claim/types.js";
import { createVerificationCommitter } from "../src/claim/verification-committer.js";

const SHOULD_RUN = process.env.RUN_INTEGRATION_TESTS === "1";

if (SHOULD_RUN) {
  const here = dirname(fileURLToPath(import.meta.url));
  const envFile = resolve(here, "..", "..", "..", ".env.local");
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

function hexFromBytes(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i]?.toString(16).padStart(2, "0");
  return s;
}

describe.skipIf(!SHOULD_RUN)(
  "verification-committer atomic-tx (integration; RUN_INTEGRATION_TESTS=1 required)",
  () => {
    let db: ReturnType<typeof createNodeClient>;
    let merkle: MerkleRepository;
    const fixtureClaimId = "00000000-0000-0000-0000-00000000d701"; // recognisable test marker
    const SIGNING = keypairFromSeed(new Uint8Array(32).fill(0x77));
    const RECOVERY = keypairFromSeed(new Uint8Array(32).fill(0x42));
    const LOG_SIGNING = generateKeypair();

    function freshClaim(suffix: string): ClaimRow {
      return {
        id: fixtureClaimId,
        agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6N",
        state: "gist_pending",
        assetType: "github_handle",
        assetValue: `verify-gist-tx-test-${suffix}`,
        ed25519PublicKeyHex: hexFromBytes(SIGNING.publicKey),
        recoveryKeyFingerprint: `sha256:${sha256Hex(RECOVERY.publicKey)}`,
        verificationCode: "VERIFYGISTTX".padEnd(32, "0"),
        startedAt: new Date(),
        completedAt: null,
      };
    }

    beforeAll(() => {
      db = createNodeClient();
      merkle = createMerkleRepository(db, { signingKey: LOG_SIGNING.privateKey });
    });

    afterEach(async () => {
      // Delete-on-revoke parity: clean up the fixture claim so re-runs
      // don't trip the partial-unique index. Cascades through ON DELETE
      // SET NULL on keys + verifications. firehose_events rows from
      // success paths are left in place (additive log).
      await db.delete(schema.claims).where(eq(schema.claims.id, fixtureClaimId));
    });

    it("commits all four writes inside one transaction on success", async () => {
      const claim = freshClaim("commit");
      // Insert the fixture claim row.
      await db.insert(schema.claims).values({
        id: claim.id,
        agentDid: claim.agentDid,
        state: claim.state,
        method: "gist",
        assetType: claim.assetType,
        assetValue: claim.assetValue,
        ed25519PublicKeyHex: claim.ed25519PublicKeyHex,
        recoveryKeyFingerprint: claim.recoveryKeyFingerprint,
        verificationCode: claim.verificationCode,
      });

      const committer = createVerificationCommitter(db, merkle);

      const beforeRoot = await merkle.getRoot();
      const beforeLeafCount = beforeRoot?.leafCount ?? 0;

      const leafPayload = {
        leaf_type: "agent-key-registration",
        did: claim.agentDid,
        ed25519_public_key_hex: claim.ed25519PublicKeyHex,
        recovery_key_fingerprint: claim.recoveryKeyFingerprint,
        published_at: new Date().toISOString(),
      };

      const result = await committer({ claim, leafPayload });

      // Assertion 1: result returned with leaf_index = N+1.
      expect(result.leafIndex).toBe(beforeLeafCount);

      // Assertion 2: claim transitioned to tier1_verified.
      const claimRows = await db
        .select({
          state: schema.claims.state,
          completedAt: schema.claims.completedAt,
        })
        .from(schema.claims)
        .where(eq(schema.claims.id, claim.id));
      expect(claimRows[0]?.state).toBe("tier1_verified");
      expect(claimRows[0]?.completedAt).not.toBeNull();

      // Assertion 3: signing key row inserted with claim_id FK.
      const keyRows = await db
        .select({
          purpose: schema.keys.purpose,
          claimId: schema.keys.claimId,
          publicKeyHex: schema.keys.publicKeyHex,
        })
        .from(schema.keys)
        .where(eq(schema.keys.claimId, claim.id));
      expect(keyRows).toHaveLength(1);
      expect(keyRows[0]?.purpose).toBe("signing");
      expect(keyRows[0]?.publicKeyHex).toBe(claim.ed25519PublicKeyHex);

      // Assertion 4: leaf appended (leafCount incremented by 1).
      const afterRoot = await merkle.getRoot();
      expect(afterRoot?.leafCount ?? 0).toBe(beforeLeafCount + 1);

      // Assertion 5: firehose_events row carries the claim.verified
      // event_type tagged to this claim's did.
      const fhRows = await db
        .select({ payload: schema.firehoseEvents.payload })
        .from(schema.firehoseEvents)
        .where(sql`${schema.firehoseEvents.payload}->>'event_type' = 'claim.verified'`);
      const matching = fhRows.filter((r) => (r.payload as { did?: string }).did === claim.agentDid);
      expect(matching.length).toBeGreaterThanOrEqual(1);
      const latest = matching[matching.length - 1]!.payload as Record<string, unknown>;
      expect(latest.event_type).toBe("claim.verified");
      expect(latest.tier).toBe(1);
      expect(latest.leaf_index).toBe(result.leafIndex);
      expect(latest.leaf_hash).toBe(result.leafHash);
    });

    it("rolls back all four writes when the merkle.append throws (no leaf, no key, no firehose)", async () => {
      const claim = freshClaim("rollback");
      await db.insert(schema.claims).values({
        id: claim.id,
        agentDid: claim.agentDid,
        state: claim.state,
        method: "gist",
        assetType: claim.assetType,
        assetValue: claim.assetValue,
        ed25519PublicKeyHex: claim.ed25519PublicKeyHex,
        recoveryKeyFingerprint: claim.recoveryKeyFingerprint,
        verificationCode: claim.verificationCode,
      });

      // Wrap merkle so .append throws — simulates a leaf-validation
      // failure or signing-key-missing failure deep inside the tx body.
      // The committer's tx must roll back the claim update + key
      // insert that ran BEFORE the throw, AND the firehose insert
      // that would have run AFTER must not exist.
      const sentinel = "verify-gist-tx-sentinel";
      const failingMerkle: MerkleRepository = {
        ...merkle,
        append: async () => {
          throw new Error(sentinel);
        },
      };
      const committer = createVerificationCommitter(db, failingMerkle);

      const beforeRoot = await merkle.getRoot();
      const beforeLeafCount = beforeRoot?.leafCount ?? 0;

      const leafPayload = {
        leaf_type: "agent-key-registration",
        did: claim.agentDid,
        ed25519_public_key_hex: claim.ed25519PublicKeyHex,
        recovery_key_fingerprint: claim.recoveryKeyFingerprint,
        published_at: new Date().toISOString(),
      };

      await expect(committer({ claim, leafPayload })).rejects.toThrow(sentinel);

      // Assertion 1: claim row STILL gist_pending (state update rolled back).
      const claimRows = await db
        .select({ state: schema.claims.state })
        .from(schema.claims)
        .where(eq(schema.claims.id, claim.id));
      expect(claimRows[0]?.state).toBe("gist_pending");

      // Assertion 2: no signing key row inserted.
      const keyRows = await db
        .select({ id: schema.keys.id })
        .from(schema.keys)
        .where(eq(schema.keys.claimId, claim.id));
      expect(keyRows).toHaveLength(0);

      // Assertion 3: leaf count unchanged.
      const afterRoot = await merkle.getRoot();
      expect(afterRoot?.leafCount ?? 0).toBe(beforeLeafCount);

      // Assertion 4: no firehose_events row for this did.
      const fhRows = await db
        .select({ payload: schema.firehoseEvents.payload })
        .from(schema.firehoseEvents)
        .where(sql`${schema.firehoseEvents.payload}->>'event_type' = 'claim.verified'`);
      const matching = fhRows.filter((r) => (r.payload as { did?: string }).did === claim.agentDid);
      expect(matching).toHaveLength(0);
    });
  },
);
