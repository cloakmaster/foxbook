// Integration test for the ADR 0004 addendum-1 tx-context variant of
// merkle-repository.append. Proves that when the caller passes opts.tx
// and then throws mid-transaction, ALL three writes (leaf, firehose
// row, claim delete) roll back atomically — there is no silent-failure
// window between the leaf append and the claim delete.
//
// **GATED**: runs only when RUN_INTEGRATION_TESTS=1 because it requires
// a live Postgres connection (DATABASE_URL pointing at dev). CI doesn't
// have a Postgres service today, so the default test run skips this
// suite. Run locally via:
//
//   RUN_INTEGRATION_TESTS=1 pnpm --filter @foxbook/api test
//
// The test inserts a fixture claim row, attempts a transaction that
// throws after merkle.append, and asserts post-rollback that the row
// is still present and no leaf was added. Cleans up the fixture row
// in afterEach (idempotent — DELETE WHERE id matches; no-op if the
// transaction rolled back the insert too).

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { generateKeypair, keypairFromSeed } from "@foxbook/core";
import {
  createMerkleRepository,
  createNodeClient,
  type MerkleRepository,
  schema,
} from "@foxbook/db";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const SHOULD_RUN = process.env.RUN_INTEGRATION_TESTS === "1";

// Load .env.local when this integration test actually runs. Vitest's
// default invocation (`vitest run` from the test script) does NOT
// inherit Node's `--env-file=` flag, so DATABASE_URL isn't in
// process.env at suite-load and createNodeClient() throws. Smoke
// scripts dodge this by going through `node --env-file=...` directly;
// the test surface uses vitest, which doesn't.
//
// Local-load only: gated behind RUN_INTEGRATION_TESTS=1 + existsSync
// so CI (no .env.local) is unaffected. Idempotent — re-loading the
// same file silently overwrites; safe if a parent shell already
// exported DATABASE_URL with the same value.
//
// loadEnvFile is Node's built-in (added 20.12.0 / 21.7.0). Available
// on this project's >=22 engine constraint.
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
  "merkle-repository tx-context (integration; RUN_INTEGRATION_TESTS=1 required)",
  () => {
    let db: ReturnType<typeof createNodeClient>;
    let merkle: MerkleRepository;
    const fixtureClaimId = "00000000-0000-0000-0000-00000000d6b6"; // recognisable test marker
    const fixtureAssetValue = `tx-context-test-${Date.now()}`;
    const SIGNING = keypairFromSeed(new Uint8Array(32).fill(0x77));
    const RECOVERY = keypairFromSeed(new Uint8Array(32).fill(0x42));
    const LOG_SIGNING = generateKeypair();

    beforeAll(() => {
      db = createNodeClient();
      merkle = createMerkleRepository(db, { signingKey: LOG_SIGNING.privateKey });
    });

    afterEach(async () => {
      // Clean up any fixture row that may have escaped a test path.
      // Idempotent — no-op if rollback already removed it.
      await db.delete(schema.claims).where(eq(schema.claims.id, fixtureClaimId));
      await db
        .delete(schema.firehoseEvents)
        .where(sql`${schema.firehoseEvents.payload}->>'event_type' = 'tx-context-test'`);
    });

    it("rolls back leaf insert + firehose insert when caller throws after merkle.append({tx})", async () => {
      // Setup: insert a real claim row that the test transaction would otherwise delete.
      await db.insert(schema.claims).values({
        id: fixtureClaimId,
        agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        state: "tier1_verified",
        method: "gist",
        assetType: "github_handle",
        assetValue: fixtureAssetValue,
        ed25519PublicKeyHex: hexFromBytes(SIGNING.publicKey),
        recoveryKeyFingerprint: `sha256:${hexFromBytes(RECOVERY.publicKey)}`,
        verificationCode: "TXCONTEXTTEST".padEnd(32, "0"),
      });

      const beforeRoot = await merkle.getRoot();
      const beforeLeafCount = beforeRoot?.leafCount ?? 0;

      const sentinel = "tx-context rollback sentinel";
      await expect(
        db.transaction(async (tx) => {
          await merkle.append(
            {
              leaf_type: "revocation",
              did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
              revoked_key_hex: hexFromBytes(SIGNING.publicKey),
              recovery_key_signature: "header.payload.signature",
              revocation_timestamp: new Date().toISOString(),
            },
            { tx },
          );
          await tx.insert(schema.firehoseEvents).values({
            reportId: "tx-context-test",
            envelopeVersion: "1.0-draft",
            payload: { event_type: "tx-context-test", marker: fixtureAssetValue },
          });
          // Throw BEFORE the claim delete. If rollback works, the leaf
          // append and firehose insert above are also undone.
          throw new Error(sentinel);
        }),
      ).rejects.toThrow(sentinel);

      // Assertions:
      //   1. Claim row is still present (delete didn't run; throw was before it).
      const claimRows = await db
        .select({ id: schema.claims.id })
        .from(schema.claims)
        .where(eq(schema.claims.id, fixtureClaimId));
      expect(claimRows).toHaveLength(1);

      //   2. No new leaves added (rolled back).
      const afterRoot = await merkle.getRoot();
      expect(afterRoot?.leafCount ?? 0).toBe(beforeLeafCount);

      //   3. No firehose row carrying our test marker.
      const fhRows = await db
        .select({ id: schema.firehoseEvents.id })
        .from(schema.firehoseEvents)
        .where(sql`${schema.firehoseEvents.payload}->>'marker' = ${fixtureAssetValue}`);
      expect(fhRows).toHaveLength(0);
    });

    it("commits all three writes on success (positive control: rollback only fires on throw)", async () => {
      await db.insert(schema.claims).values({
        id: fixtureClaimId,
        agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        state: "tier1_verified",
        method: "gist",
        assetType: "github_handle",
        assetValue: `${fixtureAssetValue}-commit`,
        ed25519PublicKeyHex: hexFromBytes(SIGNING.publicKey),
        recoveryKeyFingerprint: `sha256:${hexFromBytes(RECOVERY.publicKey)}`,
        verificationCode: "TXCOMMITTEST".padEnd(32, "0"),
      });

      const beforeRoot = await merkle.getRoot();
      const beforeLeafCount = beforeRoot?.leafCount ?? 0;

      await db.transaction(async (tx) => {
        await merkle.append(
          {
            leaf_type: "revocation",
            did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
            revoked_key_hex: hexFromBytes(SIGNING.publicKey),
            recovery_key_signature: "header.payload.signature",
            revocation_timestamp: new Date().toISOString(),
          },
          { tx },
        );
        await tx.insert(schema.firehoseEvents).values({
          reportId: "tx-context-commit",
          envelopeVersion: "1.0-draft",
          payload: { event_type: "tx-context-test", marker: `${fixtureAssetValue}-commit` },
        });
        await tx.delete(schema.claims).where(eq(schema.claims.id, fixtureClaimId));
      });

      // Leaf appended.
      const afterRoot = await merkle.getRoot();
      expect(afterRoot?.leafCount ?? 0).toBe(beforeLeafCount + 1);

      // Claim row gone.
      const remaining = await db
        .select({ id: schema.claims.id })
        .from(schema.claims)
        .where(eq(schema.claims.id, fixtureClaimId));
      expect(remaining).toHaveLength(0);

      // Cleanup — firehose row is left for afterEach to handle.
    });
  },
);
