#!/usr/bin/env node

// Re-sign the current signed tree head with the configured signing key.
//
// Recovery tool for the July 2026 incident (docs/OPERATIONS.md § "STH
// signing-key mismatch"): the stored STH was signed by a seed the
// deployment no longer holds, so it does not verify against the public
// key served at /.well-known/foxbook.json. Every third-party verify()
// call fails. The Merkle tree itself is intact — leaf data is untouched
// and inclusion proofs still reconstruct to the recorded root; only the
// signature is unverifiable.
//
// What it does: recomputes the STH JWS over the EXISTING
// (log_id, tree_size, root_hash) with a fresh timestamp, signed by the
// current key, and UPDATEs the latest transparency_log row in place.
//
// What it does NOT do:
//   - touch tl_leaves. No leaf is added, removed, or rewritten.
//   - change root_hash or leaf_count. The tree is not re-derived; the
//     recorded root is carried across verbatim.
//   - insert a new row. Two rows sharing a leaf_count would make
//     `ORDER BY leaf_count DESC LIMIT 1` (how getRoot picks the STH)
//     nondeterministic — the log would serve one of two STHs at random.
//
// Deliberately implemented with no @foxbook/* imports: a recovery tool
// has to work when the workspace doesn't build, and `@foxbook/core`
// resolves to TypeScript source that plain `node` cannot load. The
// signing path is a hand-rolled mirror of `signTreeHead` + `jwsSign`;
// resign-sth-parity.test.ts is the continuous proof that the two
// produce byte-identical tokens. If that test goes red, this script is
// no longer safe to run.
//
// ⚠️  DISCLOSURE. Re-signing means any STH a third party captured before
// this runs stays unverifiable forever. That is a real break in the
// "past inclusion proofs verify forever" promise in
// docs/specs/did-foxbook-method.md § Security Considerations. Practically
// nobody holds an old STH here — the log has had no integrators — but
// the promise is written down, so if you run this, disclose it: a dated
// note in OPERATIONS.md and in the DID method spec's security section.
// Prefer restoring the original seed if it exists anywhere; that path
// needs no disclosure because it strands nothing.
//
// Refuses to run if the stored STH already verifies — there is nothing
// to repair, and re-signing a healthy log would strand history for no
// reason.
//
// Usage (dry run — prints the plan, writes nothing):
//   pnpm --filter @foxbook/db db:resign-sth
//
// Usage (apply):
//   pnpm --filter @foxbook/db db:resign-sth -- --commit
//
// Requires FOXBOOK_LOG_SIGNING_KEY_HEX and DATABASE_URL in .env.local.
// Point DATABASE_URL at whatever log you intend to repair and read the
// dry-run output before passing --commit.

import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from "node:crypto";
import { pathToFileURL } from "node:url";

export const STH_VERSION = "1.0-draft";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

/** Ed25519 32-byte seed → { privateKey, publicKeyRaw }. */
export function keypairFromSeed(seed) {
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    Buffer.from(seed),
  ]);
  const privateKey = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  const spki = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  return { privateKey, publicKeyRaw: spki.subarray(spki.length - 32) };
}

/**
 * Compact-JWS sign, mirroring core's `jwsSign`. Canonicalization is
 * `JSON.stringify` with caller-controlled key order — core's
 * `canonicalJsonBytes` is literally `textEncoder.encode(JSON.stringify(obj))`.
 */
export function jwsSign(protectedHeader, payload, seed) {
  const { privateKey } = keypairFromSeed(seed);
  const headerB64 = b64u(Buffer.from(JSON.stringify(protectedHeader), "utf8"));
  const payloadB64 = b64u(Buffer.from(JSON.stringify(payload), "utf8"));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = edSign(null, Buffer.from(signingInput, "utf8"), privateKey);
  return `${signingInput}.${b64u(sig)}`;
}

/** Verify a compact JWS against a raw 32-byte Ed25519 public key. */
export function jwsVerifyRaw(token, publicKeyRaw) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error(`expected 3 JWS segments, got ${parts.length}`);
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    Buffer.from(publicKeyRaw),
  ]);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  return edVerify(
    null,
    Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"),
    key,
    Buffer.from(parts[2], "base64url"),
  );
}

/**
 * Build the STH payload. Key order is load-bearing and must match
 * `signTreeHead` in merkle-repository.ts exactly.
 */
export function sthPayload(logId, treeSize, rootHashHex, timestampIso) {
  return {
    log_id: logId,
    tree_size: treeSize,
    root_hash: rootHashHex,
    timestamp: timestampIso,
    version: STH_VERSION,
  };
}

async function main() {
  const { default: postgres } = await import("postgres");

  const COMMIT = process.argv.slice(2).includes("--commit");
  const LOG_ID = process.env.FOXBOOK_LOG_ID ?? "foxbook-v1";

  const fail = (msg) => {
    console.error(`✗ ${msg}`);
    process.exit(1);
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is not set (expected in .env.local).");

  const seedHex = process.env.FOXBOOK_LOG_SIGNING_KEY_HEX?.trim();
  if (!seedHex || !/^[0-9a-f]{64}$/i.test(seedHex)) {
    fail("FOXBOOK_LOG_SIGNING_KEY_HEX is not set, or is not 64 hex chars.");
  }

  const seed = Uint8Array.from(Buffer.from(seedHex, "hex"));
  const { publicKeyRaw } = keypairFromSeed(seed);

  const target = databaseUrl.replace(/\/\/[^@]*@/, "//<redacted>@");
  console.log(`log_id     : ${LOG_ID}`);
  console.log(`database   : ${target}`);
  console.log(`public key : ${Buffer.from(publicKeyRaw).toString("hex")}`);
  console.log(`mode       : ${COMMIT ? "COMMIT (will write)" : "dry run (no writes)"}\n`);

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Serialise against concurrent appends: append() takes the same
    // advisory lock on hashtext(log_id), so holding it here means we
    // cannot re-sign a tree head an in-flight append is about to
    // supersede.
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${LOG_ID}))`;

      const rows = await tx`
        SELECT id, root_hash, leaf_count, signed_tree_head, published_at
        FROM transparency_log
        WHERE log_id = ${LOG_ID}
        ORDER BY leaf_count DESC
        LIMIT 1`;

      const row = rows[0];
      if (!row) fail(`no transparency_log row for log_id "${LOG_ID}" — nothing to re-sign.`);

      const treeSize = Number(row.leaf_count);
      console.log(`current STH: tree_size=${treeSize} root=${row.root_hash}`);
      console.log(`             published_at=${new Date(row.published_at).toISOString()}`);

      let alreadyValid = false;
      try {
        alreadyValid = jwsVerifyRaw(row.signed_tree_head, publicKeyRaw);
      } catch (e) {
        console.log(`             stored STH is unparseable (${e.message})`);
      }

      if (alreadyValid) {
        console.log(
          "\n✓ The stored STH already verifies against the configured key. Nothing to do.\n" +
            "  Re-signing a healthy log would strand captured history for no reason,\n" +
            "  so this is a refusal, not a no-op.",
        );
        throw Object.assign(new Error("already valid"), { benign: true });
      }

      console.log("             does NOT verify against the configured key → repairable\n");

      const timestamp = new Date();
      const payload = sthPayload(LOG_ID, treeSize, row.root_hash, timestamp.toISOString());
      const sthJws = jwsSign({ alg: "EdDSA", typ: "JWT" }, payload, seed);

      // Verify what we produced before it goes near the database.
      if (!jwsVerifyRaw(sthJws, publicKeyRaw)) {
        fail("internally inconsistent: freshly signed STH does not verify against its own key.");
      }

      console.log("new STH    : verifies against the configured key ✓");
      console.log(`             tree_size=${payload.tree_size} (unchanged)`);
      console.log(`             root_hash=${payload.root_hash} (unchanged)`);
      console.log(`             timestamp=${payload.timestamp} (fresh)`);

      if (!COMMIT) {
        console.log(
          "\nDry run — nothing written. Re-run with --commit to apply.\n" +
            "Then verify from outside the system:  node scripts/verify-live-log.mjs",
        );
        throw Object.assign(new Error("dry run"), { benign: true });
      }

      const updated = await tx`
        UPDATE transparency_log
        SET signed_tree_head = ${sthJws}, published_at = ${timestamp}
        WHERE id = ${row.id}
        RETURNING id`;

      if (updated.length !== 1) {
        fail(`expected to update exactly 1 row, updated ${updated.length}. Rolled back.`);
      }

      console.log(`\n✓ Updated transparency_log row ${row.id}.`);
      console.log("  tl_leaves untouched; root_hash and leaf_count unchanged.");
    });

    if (COMMIT) {
      console.log(
        "\nNext:\n" +
          "  1. node scripts/verify-live-log.mjs      (expect PASS)\n" +
          "  2. Disclose the re-sign — OPERATIONS.md + the DID method spec's\n" +
          "     Security Considerations. Any STH captured before now stays\n" +
          "     unverifiable, and that promise is written down.",
      );
    }
  } catch (e) {
    if (!e?.benign) {
      console.error(`\n✗ ${e?.message ?? e}`);
      process.exitCode = 1;
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Only run when invoked directly — the exports above are imported by
// the parity test, which must not open a database connection.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
