#!/usr/bin/env node
// @ts-check

// Manual smoke-test helper for the Day-5 Tier-1 claim flow.
//
// IMPORTANT: This script imports Ed25519 primitives from @foxbook/core
// directly, not from Node's crypto module. That matches the production
// code path (apps/api / merkle-repository both go through core/src/
// crypto/ed25519.ts) and makes any future drift fail loud instead of
// passing a false-green via a serialization mismatch. Review note that
// surfaced this: "testing Node's output format against core/'s expected
// input format will produce a false red or false green."
//
// Run via pnpm so workspace resolution + TypeScript stripping are set
// up correctly:
//   pnpm smoke:tier1 --asset-value <github-handle>
//
// Prereqs (you, from your terminal — not the agent):
//   1. pnpm --filter @foxbook/db db:migrate (dev) — applies 0001+0002.
//   2. pnpm --filter @foxbook/api dev — API running locally on :8787.
//   3. FOXBOOK_LOG_SIGNING_KEY_HEX in .env.local (openssl rand -hex 32).
//
// What this does:
//   1. Mints an ephemeral Ed25519 keypair via @foxbook/core's
//      generateKeypair() — same primitive + sha512 wiring production
//      uses. publicKey + seed are 32-byte raw Uint8Arrays, hex-encoded
//      here for POST.
//   2. Mints a fake recovery-key seed + its sha256 fingerprint (via
//      Node's crypto.createHash — SHA-256 is deterministic across
//      impls, so this doesn't risk serialization drift; the Day-6
//      recovery-key keygen is proper work, this is scaffolding).
//   3. POSTs /api/v1/claim/start → prints verification_code.
//   4. Waits for you to paste the public Gist URL.
//   5. POSTs /api/v1/claim/verify-gist — on tier=1, writes the
//      artifact.
//   6. Prints the inclusion_proof_url you can curl from a fresh
//      shell to independently verify the log is publicly readable.

import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { generateKeypair } from "@foxbook/core";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..");

function arg(name: string, dflt?: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  return args[i + 1];
}

const assetValue = arg("asset-value");
const assetType = arg("asset-type", "github_handle") as string;
const apiBase = arg("api-base", "http://localhost:8787") as string;
const workerUrl = arg("worker-url");

if (!assetValue) {
  console.error("");
  console.error("smoke-test-tier1 — Day-5 live Tier-1 exercise");
  console.error("");
  console.error("Usage:");
  console.error("  pnpm smoke:tier1 --asset-value <github-handle> \\");
  console.error("      [--api-base http://localhost:8787] \\");
  console.error("      [--worker-url https://foxbook-transparency.workers.dev]");
  console.error("");
  console.error("Prereqs: pnpm --filter @foxbook/db db:migrate (dev) + apps/api running.");
  console.error("");
  process.exit(2);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type ClaimStartResponse = {
  claim_id: string;
  agent_did: string;
  verification_code: string;
  state: string;
};

type ClaimVerifyResponse =
  | { tier: 1; leaf_index: number; leaf_hash: string; root_after: string; sth_jws: string }
  | { status: string; reason?: string };

async function http<T>(
  method: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: T | null; text: string }> {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: T | null = null;
  try {
    parsed = text ? (JSON.parse(text) as T) : null;
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed, text };
}

async function main(): Promise<void> {
  console.log(`\n→ smoke test against ${apiBase}`);
  console.log(`  asset_type:   ${assetType}`);
  console.log(`  asset_value:  ${assetValue}`);

  const signing = generateKeypair();
  const recoverySeed = randomBytes(32);
  const recoveryFingerprint = `sha256:${createHash("sha256").update(recoverySeed).digest("hex")}`;

  const signingSeedHex = hex(signing.privateKey);
  const signingPubHex = hex(signing.publicKey);

  console.log(`\n→ Ed25519 keypair (via @foxbook/core.generateKeypair)`);
  console.log(`  public_key_hex:  ${signingPubHex}`);
  console.log(`  seed_hex:        ${signingSeedHex}  (save if you want to reuse)`);
  console.log(`\n→ fake recovery-key fingerprint: ${recoveryFingerprint}`);
  console.log(`  (recovery keygen is Day-6 work; this is smoke-test scaffolding)`);

  const start = await http<ClaimStartResponse>("POST", "/api/v1/claim/start", {
    asset_type: assetType,
    asset_value: assetValue,
    ed25519_public_key_hex: signingPubHex,
    recovery_key_fingerprint: recoveryFingerprint,
  });

  if (start.status !== 201 || !start.body) {
    console.error(`\n✗ /claim/start returned ${start.status}`);
    console.error(`  body: ${start.text}`);
    if (start.status === 409) {
      console.error(
        `\n  409 means (${assetType}, ${assetValue}) is already claimed. Pick a different\n  asset_value for the smoke test, or delete the existing row from Neon first.`,
      );
    }
    if (start.status === 500) {
      console.error(`\n  500 is usually "column right_edge does not exist" —`);
      console.error(`  Migration 0001 not applied. Run:`);
      console.error(`    pnpm --filter @foxbook/db db:migrate`);
    }
    process.exit(1);
  }

  const { claim_id, agent_did, verification_code } = start.body;
  console.log(`\n✓ /claim/start → 201`);
  console.log(`  claim_id:           ${claim_id}`);
  console.log(`  agent_did:          ${agent_did}`);
  console.log(`  verification_code:  ${verification_code}`);

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`  Next: create a PUBLIC GitHub Gist at https://gist.github.com`);
  console.log(`  under your @${assetValue} account, containing the string:`);
  console.log(`    ${verification_code}`);
  console.log(`  (anywhere in the body — string-contains match).`);
  console.log(`──────────────────────────────────────────────────────────────`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const gistUrl = (await rl.question("\nGist URL (https://gist.github.com/USER/ID): ")).trim();
  rl.close();

  if (!gistUrl) {
    console.error("✗ no Gist URL provided. aborting.");
    process.exit(1);
  }

  const verify = await http<ClaimVerifyResponse>("POST", "/api/v1/claim/verify-gist", {
    claim_id,
    gist_url: gistUrl,
  });

  console.log(`\n→ /claim/verify-gist → ${verify.status}`);
  console.log(`  body: ${JSON.stringify(verify.body, null, 2)}`);

  if (verify.status !== 200 || !verify.body || !("tier" in verify.body)) {
    console.error(`\n✗ verify did not reach tier=1 this round.`);
    const status = verify.body && "status" in verify.body ? verify.body.status : "(unknown)";
    if (status === "identity-mismatch") {
      console.error(
        `  → identity-mismatch: gist_url owner segment doesn't match asset_value=${assetValue}.\n    The identity guard caught it. Create the Gist under your @${assetValue} account.`,
      );
    }
    if (status === "still-pending") {
      console.error(
        `  → still-pending: Gist fetched, code not found in body. Check the Gist content\n    contains ${verification_code} verbatim and re-run this script.`,
      );
    }
    if (status === "not-found") {
      console.error(
        `  → not-found: Gist URL returned 404. Double-check the URL is public + on\n    gist.github.com (not github.com).`,
      );
    }
    process.exit(1);
  }

  const { leaf_index, leaf_hash, root_after, sth_jws } = verify.body;

  const today = new Date().toISOString().slice(0, 10);
  const outDir = join(REPO_ROOT, "ops", "bench-results");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${today}-first-live-append.txt`);

  const inclusionPath = `/inclusion/${leaf_index}`;
  const inclusionUrl = workerUrl ? `${workerUrl.replace(/\/$/, "")}${inclusionPath}` : null;

  const block = [
    `# Foxbook first live Tier-1 Merkle append`,
    `# ${new Date().toISOString()}`,
    ``,
    `asset_type:          ${assetType}`,
    `asset_value:         ${assetValue}`,
    `agent_did:           ${agent_did}`,
    `claim_id:            ${claim_id}`,
    `verification_code:   ${verification_code}`,
    `gist_url:            ${gistUrl}`,
    `ed25519_public_key:  ${signingPubHex}`,
    `ed25519_seed:        ${signingSeedHex}`,
    `recovery_key_fp:     ${recoveryFingerprint}`,
    ``,
    `# Merkle leaf`,
    `leaf_index:          ${leaf_index}`,
    `leaf_hash:           ${leaf_hash}`,
    `root_after:          ${root_after}`,
    ``,
    `# Signed tree head (JWS compact, EdDSA)`,
    `sth_jws:             ${sth_jws}`,
    ``,
    `# Inclusion proof (verifies against the transparency Worker)`,
    `inclusion_path:      ${inclusionPath}`,
    inclusionUrl
      ? `inclusion_url:       ${inclusionUrl}`
      : `# inclusion_url: (re-run with --worker-url once the Worker is deployed)`,
    ``,
  ].join("\n");

  if (existsSync(outFile)) {
    appendFileSync(outFile, `\n\n────────────────────────────────\n\n${block}`);
  } else {
    writeFileSync(outFile, block);
  }

  console.log(`\n✓ first live Tier-1 Merkle append captured.`);
  console.log(`  leaf_index:  ${leaf_index}`);
  console.log(`  root_after:  ${root_after}`);
  console.log(`  → ${outFile}`);

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`  Public-verifiability check (the actual demo):`);
  if (inclusionUrl) {
    console.log(`    curl -s "${inclusionUrl}" | jq .`);
    console.log(`  Run this from a fresh shell with no cookies / no auth. A 200 + valid`);
    console.log(`  JSON body means the log is publicly verifiable — that's the week-1`);
    console.log(`  north-star artifact, not just "the log exists."`);
  } else {
    console.log(`  Once the transparency Worker is deployed (gate 3), run:`);
    console.log(`    curl -s "<WORKER_URL>${inclusionPath}" | jq .`);
    console.log(`  from a fresh shell with no cookies / no auth. That turns "the log`);
    console.log(`  exists" into "the log is publicly verifiable" — the actual week-1`);
    console.log(`  demo contract.`);
  }
  console.log(`──────────────────────────────────────────────────────────────`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
