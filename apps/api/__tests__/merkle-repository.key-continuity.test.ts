// Integration test for the key-continuity guard in
// merkle-repository.append.
//
// The guard refuses to extend a log when the configured signing key is
// not the key that signed the log's prior STH. Without it, appending
// under a swapped seed silently strands every earlier STH against the
// advertised public key — permanently, because an append-only log
// cannot retract the write. That is the July 2026 incident, which ran
// undetected for 58 days (docs/OPERATIONS.md § "STH signing-key
// mismatch").
//
// **GATED**: runs only when RUN_INTEGRATION_TESTS=1, like the
// tx-context suite. CI provides a disposable Postgres service
// container for this.
//
// ⚠️  Do NOT run the integration suites against production. `tl_leaves`
// is keyed by a global `leaf_index` with no `log_id` column, so a
// separate test log does NOT isolate writes from the real log. This
// suite is written to avoid the problem — the refusal cases write
// nothing at all, and the one success case uses a leaf-index offset far
// beyond any real log and cleans up after itself — but the general
// warning stands, and is the exact hazard this guard exists to catch.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { generateKeypair, jwsSign, keypairFromSeed } from "@foxbook/core";
import { createMerkleRepository, createNodeClient, schema } from "@foxbook/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SHOULD_RUN = process.env.RUN_INTEGRATION_TESTS === "1";

if (SHOULD_RUN) {
  const here = dirname(fileURLToPath(import.meta.url));
  const envFile = resolve(here, "..", "..", "..", ".env.local");
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

/** Sign an STH the same way merkle-repository does, for seeding. */
function sth(privateKey: Uint8Array, logId: string, treeSize: number, rootHash: string) {
  return jwsSign(
    { alg: "EdDSA", typ: "JWT" },
    {
      log_id: logId,
      tree_size: treeSize,
      root_hash: rootHash,
      timestamp: new Date().toISOString(),
      version: "1.0-draft",
    },
    privateKey,
  );
}

describe.skipIf(!SHOULD_RUN)(
  "merkle-repository key continuity (integration; RUN_INTEGRATION_TESTS=1 required)",
  () => {
    let db: ReturnType<typeof createNodeClient>;

    // Distinct log id per run so concurrent runs can't collide.
    const LOG_ID = `key-continuity-test-${Date.now()}`;
    // Far beyond any real log, so the one success-path append cannot
    // collide with a genuine leaf_index on the shared tl_leaves table.
    const SEED_TREE_SIZE = 9_000_000_000;
    const SEED_ROOT = "a".repeat(64);

    const KEY_A = keypairFromSeed(new Uint8Array(32).fill(0x11));
    const KEY_B = keypairFromSeed(new Uint8Array(32).fill(0x22));

    beforeAll(async () => {
      db = createNodeClient();
      // Seed a prior STH signed by KEY_A. No tl_leaves row — the
      // refusal path never reads or writes one.
      await db.insert(schema.transparencyLog).values({
        logId: LOG_ID,
        rootHash: SEED_ROOT,
        leafCount: BigInt(SEED_TREE_SIZE),
        signedTreeHead: sth(KEY_A.privateKey, LOG_ID, SEED_TREE_SIZE, SEED_ROOT),
        rightEdge: [],
        publishedAt: new Date(),
      });
    });

    afterAll(async () => {
      await db.delete(schema.transparencyLog).where(eq(schema.transparencyLog.logId, LOG_ID));
      await db
        .delete(schema.tlLeaves)
        .where(sql`${schema.tlLeaves.leafIndex} >= ${BigInt(SEED_TREE_SIZE)}`);
    });

    it("refuses to append when the signing key did not sign the prior STH", async () => {
      const repo = createMerkleRepository(db, { signingKey: KEY_B.privateKey, logId: LOG_ID });

      await expect(repo.append({ kind: "key-continuity-test", n: 1 })).rejects.toThrow(
        /did not sign the prior signed tree head/,
      );
    });

    it("writes nothing when it refuses — no leaf, no new STH row", async () => {
      const repo = createMerkleRepository(db, { signingKey: KEY_B.privateKey, logId: LOG_ID });

      await expect(repo.append({ kind: "key-continuity-test", n: 2 })).rejects.toThrow();

      const rows = await db
        .select({ leafCount: schema.transparencyLog.leafCount })
        .from(schema.transparencyLog)
        .where(eq(schema.transparencyLog.logId, LOG_ID));
      expect(rows).toHaveLength(1);
      expect(Number(rows[0]?.leafCount)).toBe(SEED_TREE_SIZE);

      const leaves = await db
        .select({ leafIndex: schema.tlLeaves.leafIndex })
        .from(schema.tlLeaves)
        .where(sql`${schema.tlLeaves.leafIndex} >= ${BigInt(SEED_TREE_SIZE)}`);
      expect(leaves).toHaveLength(0);
    });

    it("refuses when the prior STH is malformed rather than merely wrong-key", async () => {
      const badLogId = `${LOG_ID}-malformed`;
      await db.insert(schema.transparencyLog).values({
        logId: badLogId,
        rootHash: SEED_ROOT,
        leafCount: BigInt(SEED_TREE_SIZE),
        signedTreeHead: "not-a-compact-jws",
        rightEdge: [],
        publishedAt: new Date(),
      });

      const repo = createMerkleRepository(db, { signingKey: KEY_A.privateKey, logId: badLogId });
      await expect(repo.append({ kind: "key-continuity-test", n: 3 })).rejects.toThrow(
        /could not be parsed/,
      );

      await db.delete(schema.transparencyLog).where(eq(schema.transparencyLog.logId, badLogId));
    });

    it("allows the append when the key is continuous with the prior STH", async () => {
      const repo = createMerkleRepository(db, { signingKey: KEY_A.privateKey, logId: LOG_ID });

      const result = await repo.append({ kind: "key-continuity-test", n: 4 });
      expect(result.leafIndex).toBe(SEED_TREE_SIZE);
      expect(result.sthJws.split(".")).toHaveLength(3);
    });

    it("does not gate the first-ever append, when there is no prior STH", async () => {
      // A fresh log has nothing to be continuous with; the guard must
      // not turn an empty log into an unappendable one.
      const freshLogId = `${LOG_ID}-fresh`;
      const repo = createMerkleRepository(db, {
        signingKey: generateKeypair().privateKey,
        logId: freshLogId,
      });

      // On an empty tl_leaves (CI) this lands at leaf_index 0. Against a
      // populated shared table the index collides instead — either way
      // the assertion is the same: the guard must not be what rejected
      // it. `tl_leaves` has no log_id column, so a successful append
      // here writes a row that other suites' appends would collide
      // with; clean it up by the index we actually got rather than
      // assuming one.
      let appendedIndex: number | undefined;
      try {
        appendedIndex = (await repo.append({ kind: "key-continuity-test", n: 5 })).leafIndex;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        expect(msg).not.toMatch(/did not sign the prior signed tree head/);
        expect(msg).not.toMatch(/could not be parsed/);
      }

      if (appendedIndex !== undefined) {
        await db
          .delete(schema.tlLeaves)
          .where(eq(schema.tlLeaves.leafIndex, BigInt(appendedIndex)));
      }
      await db.delete(schema.transparencyLog).where(eq(schema.transparencyLog.logId, freshLogId));
    });
  },
);
