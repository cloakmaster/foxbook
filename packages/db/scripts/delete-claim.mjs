#!/usr/bin/env node

// Dev helper: delete a single claims row by (asset_type, asset_value).
//
// Why this exists: the Day-5 smoke-test flow inserts a claim on
// /claim/start; if the run doesn't reach tier1_verified (because the
// Gist wasn't posted, the verify-gist call 500'd, the API was missing
// its signing key, etc.), the row stays in state=gist_pending and the
// partial-UNIQUE index on (asset_type, asset_value) 409s any retry
// with the same asset. This script deletes that stale row.
//
// Scoped narrowly: DELETE only matches on the provided (asset_type,
// asset_value) pair, and only when both are non-null. Prints the
// number of rows deleted. Does NOT touch tl_leaves or transparency_
// log (those are append-only; data there is authoritative and must
// not be rolled back).
//
// Usage:
//   pnpm --filter @foxbook/db db:delete-claim -- \
//     --asset-type github_handle --asset-value samrg472
//
// Safe to re-run. A delete against a non-existent row is a no-op.

import postgres from "postgres";

function arg(name) {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  return args[i + 1];
}

const assetType = arg("asset-type");
const assetValue = arg("asset-value");

if (!assetType || !assetValue) {
  console.error(
    "Usage: pnpm --filter @foxbook/db db:delete-claim -- --asset-type <github_handle|x_handle|domain> --asset-value <handle>",
  );
  process.exit(2);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (pass via --env-file).");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  const result = await sql`
    DELETE FROM claims
    WHERE asset_type = ${assetType}::asset_type
      AND asset_value = ${assetValue}
    RETURNING id, state, started_at
  `;

  if (result.length === 0) {
    console.log(`→ no claim found for (${assetType}, ${assetValue}). nothing deleted.`);
  } else {
    console.log(`✓ deleted ${result.length} row(s):`);
    for (const row of result) {
      console.log(`    id=${row.id} state=${row.state} started_at=${row.started_at.toISOString()}`);
    }
  }
} catch (e) {
  console.error("✗ delete failed:");
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
