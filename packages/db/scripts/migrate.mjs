#!/usr/bin/env node

// Scripted Drizzle migration runner with transition-gap detection.
//
// Replaces `drizzle-kit migrate` for day-to-day use. Why not the CLI:
//
//   1. drizzle-kit's ora-based spinner overwrites its own stdout +
//      stderr with \r\x1b[2K\x1b[1G sequences. When a migration errors,
//      the error text gets clobbered before it reaches a pipe —
//      Benjamin's terminal shows empty lines between the "applying
//      migrations..." spinner and "Exit status 1" with no error text
//      in between. This script uses drizzle-orm/postgres-js/migrator
//      directly (same migrator internals, no spinner) so errors print
//      with a full stack trace, every time.
//
//   2. Day-5 has a one-time transition gap from PR #5's
//      `drizzle-kit push --force` bootstrap: schema exists in public
//      but drizzle.__drizzle_migrations is empty, so the first
//      migrate attempt tries to apply 0000_v0_schema.sql against an
//      already-bootstrapped schema and errors on the first CREATE
//      TYPE / CREATE TABLE collision. This script detects that state
//      and auto-seeds __drizzle_migrations for 0000 before running
//      forward migrations (only when run with --auto-fix; default is
//      report-only so nothing is mutated without explicit consent per
//      ADR 0002).
//
// Exits 0 on success. Exits 1 with a full error on any DB failure.
// Exits 2 if it detects the transition gap and --auto-fix is NOT set
// (prints the exact commands to run).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = join(SCRIPT_DIR, "..");
const MIGRATIONS_DIR = join(PACKAGE_DIR, "migrations");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set (pass via --env-file).");
  process.exit(1);
}

const autoFix = process.argv.includes("--auto-fix");

// One connection, explicitly closed at the end. No pooling needed.
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

function log(msg) {
  process.stdout.write(`${msg}\n`);
}
function err(msg) {
  process.stderr.write(`${msg}\n`);
}

async function readJournal() {
  const path = join(MIGRATIONS_DIR, "meta", "_journal.json");
  return JSON.parse(readFileSync(path, "utf-8"));
}

async function detectState() {
  // Does the drizzle schema exist?
  const drizzleSchema = await sql`
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'drizzle'
  `;
  const drizzleSchemaExists = drizzleSchema.length > 0;

  // Is the migrations tracking table populated?
  let migrationsApplied = [];
  if (drizzleSchemaExists) {
    try {
      migrationsApplied = await sql`
        SELECT hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at
      `;
    } catch {
      // table doesn't exist yet, or other issue — treat as empty
      migrationsApplied = [];
    }
  }

  // Does public.agents (a v0 schema table) exist?
  const agentsExists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'agents' AND table_schema = 'public'
  `;
  const v0SchemaExists = agentsExists.length > 0;

  return {
    drizzleSchemaExists,
    migrationsAppliedCount: migrationsApplied.length,
    v0SchemaExists,
  };
}

function hashMigration(tag) {
  const sqlText = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), "utf-8");
  return createHash("sha256").update(sqlText).digest("hex");
}

async function seedBootstrappedMigration(tag, whenMillis) {
  const hash = hashMigration(tag);
  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${whenMillis})
  `;
  log(`  seeded ${tag} (hash ${hash.slice(0, 12)}…, when ${whenMillis})`);
}

async function ensureDrizzleSchema() {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
}

async function runDrizzleMigrate() {
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
}

async function main() {
  log(`→ scripted migrate — ${MIGRATIONS_DIR}`);
  const state = await detectState();
  log(
    `→ state: drizzle_schema=${state.drizzleSchemaExists}, migrations_applied=${state.migrationsAppliedCount}, v0_tables_present=${state.v0SchemaExists}`,
  );

  const isTransitionCase = state.v0SchemaExists && state.migrationsAppliedCount === 0;

  if (isTransitionCase) {
    log("");
    log("⚠ Transition gap detected:");
    log("  The v0 schema (public.agents et al.) exists but");
    log("  drizzle.__drizzle_migrations is empty. This happens when the");
    log("  DB was bootstrapped via `drizzle-kit push --force` (PR #5).");
    log("  Running drizzle's migrate() now would try to apply");
    log("  0000_v0_schema.sql against the already-existing schema and");
    log("  error on the first CREATE TYPE / CREATE TABLE collision.");
    log("");
    log("  Fix: seed drizzle.__drizzle_migrations with the hash of");
    log("  0000_v0_schema.sql so drizzle treats it as already-applied,");
    log("  then apply 0001 + 0002 forward.");
    log("");

    if (!autoFix) {
      log("  Re-run with --auto-fix to apply the seed + run migrations:");
      log("    pnpm --filter @foxbook/db db:migrate -- --auto-fix");
      log("");
      log("  (Defaulting to report-only per ADR 0002 — no DB writes");
      log("  without explicit consent.)");
      await sql.end();
      process.exit(2);
    }

    log("→ --auto-fix set; seeding __drizzle_migrations...");
    await ensureDrizzleSchema();

    const journal = await readJournal();
    // Seed ONLY the bootstrapped migration (0000). Any others should
    // apply forward normally via drizzle's migrate().
    const bootstrapped = journal.entries.filter((e) => e.tag === "0000_v0_schema");
    for (const entry of bootstrapped) {
      await seedBootstrappedMigration(entry.tag, entry.when);
    }
    log(`✓ seeded ${bootstrapped.length} bootstrapped migration(s)`);
    log("");
  }

  log("→ running drizzle-orm migrate()");
  await runDrizzleMigrate();
  log("✓ migrations applied");

  // Re-read state to confirm
  const finalState = await detectState();
  log(`→ final state: migrations_applied=${finalState.migrationsAppliedCount}`);
}

main()
  .catch((e) => {
    err("");
    err("✗ migration failed:");
    err(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
