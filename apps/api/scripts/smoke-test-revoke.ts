#!/usr/bin/env node
// @ts-check

// Day-6 PR B — live revocation smoke. Six assertions + wall-clock gate.
//
// Run via pnpm so workspace resolution + tsx are wired up:
//   pnpm smoke:revoke --asset-value <github-handle-you-own>
//
// The asset_value MUST be a real GitHub account you can post Gists from
// — the identity-guard rejects any Gist URL whose path username doesn't
// match. (Cowork-flagged failure mode from the 2026-04-26 baseline.)
//
// Prereqs:
//   1. Migration 0003 applied to dev (pnpm --filter @foxbook/db db:migrate).
//   2. apps/api running (pnpm --filter @foxbook/api dev).
//   3. FOXBOOK_LOG_SIGNING_KEY_HEX set in .env.local.
//   4. The asset_value's slot is free in dev (delete prior cloakmaster
//      row from Neon if you want to reuse the slug).
//
// What this does:
//   1. Mints REAL signing + recovery keypairs via @foxbook/core (NOT
//      Node's crypto — same primitive production uses, no serialisation
//      drift).
//   2. POSTs /claim/start, prints the verification_code.
//   3. Waits for you to paste the Gist URL after creating one under
//      @<asset_value> with the code in the body.
//   4. POSTs /claim/verify-gist → tier=1 (leaf at index N).
//   5. Builds the revocation JWS using the recovery keypair (header
//      carries the OKP/Ed25519 jwk so the verifier knows which public
//      key to check — same shape claim/revoke handler expects).
//   6. POSTs /claim/revoke with wall-clock measurement.
//   7. Asserts: 200, revoked=true, leaf_index = N+1, ≤500ms.
//   8. Asserts: /claim/start with the SAME asset_value + a DIFFERENT
//      ed25519 keypair returns 201 (asset slot freed by the delete).
//   9. Writes ops/bench-results/YYYY-MM-DD-first-live-revocation.txt.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { generateKeypair, jwsSign, sha256Hex } from "@foxbook/core";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..");

function arg(name: string, dflt?: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  return args[i + 1];
}

const assetValue = arg("asset-value");
const apiBase = arg("api-base", "http://localhost:8787") as string;
const wallClockBudgetMs = Number(arg("wall-clock-budget-ms", "500"));

if (!assetValue) {
  console.error("");
  console.error("smoke-test-revoke — Day-6 live revocation exercise");
  console.error("");
  console.error("Usage:");
  console.error("  pnpm smoke:revoke --asset-value <github-handle-you-own> \\");
  console.error("      [--api-base http://localhost:8787] \\");
  console.error("      [--wall-clock-budget-ms 500]");
  console.error("");
  console.error(
    "asset-value MUST be a real GitHub account; identity-guard rejects mismatched Gist URLs.",
  );
  console.error("");
  process.exit(2);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
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

type ClaimRevokeResponse =
  | { revoked: true; leaf_index: number; leaf_hash: string; sth_jws: string }
  | { status: string; reason?: string; current_state?: string };

async function http<T>(
  method: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: T | null; text: string; elapsedMs: number }> {
  const t0 = performance.now();
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const elapsedMs = performance.now() - t0;
  let parsed: T | null = null;
  try {
    parsed = text ? (JSON.parse(text) as T) : null;
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed, text, elapsedMs };
}

function buildRevocationJws(
  payload: {
    did: string;
    revoked_key_hex: string;
    revocation_timestamp: string;
    reason_code?: "key_compromise" | "owner_request" | "superseded";
  },
  recoveryPriv: Uint8Array,
  recoveryPub: Uint8Array,
): string {
  // Field order = alphabetical = canonical signing-input order. Caller
  // and verifier MUST agree on this order; canonical.ts uses
  // JSON.stringify (insertion order), so we put fields in alphabetical
  // order here so the bytes match what the handler reconstructs.
  const signed: Record<string, unknown> = {};
  signed.did = payload.did;
  signed.leaf_type = "revocation";
  if (payload.reason_code !== undefined) signed.reason_code = payload.reason_code;
  signed.revocation_timestamp = payload.revocation_timestamp;
  signed.revoked_key_hex = payload.revoked_key_hex;
  return jwsSign(
    {
      alg: "EdDSA",
      typ: "JWT",
      jwk: { kty: "OKP", crv: "Ed25519", x: base64url(recoveryPub) },
    },
    signed,
    recoveryPriv,
  );
}

async function main(): Promise<void> {
  console.log(`\n→ smoke-test-revoke against ${apiBase}`);
  console.log(`  asset_value:        ${assetValue}`);
  console.log(`  wall_clock_budget:  ${wallClockBudgetMs}ms`);

  // Generate REAL recovery + signing keypairs. The recovery key seed
  // stays in process memory; we never persist it to disk for security
  // hygiene (recovery key is held offline in production).
  const signing = generateKeypair();
  const recovery = generateKeypair();

  const signingPubHex = hex(signing.publicKey);
  const recoveryFingerprint = `sha256:${sha256Hex(recovery.publicKey)}`;

  console.log(`\n→ Ed25519 keypairs (via @foxbook/core.generateKeypair)`);
  console.log(`  signing public_key_hex:   ${signingPubHex}`);
  console.log(`  recovery fingerprint:     ${recoveryFingerprint}`);

  // ---- 1. Mint claim ----
  const start = await http<ClaimStartResponse>("POST", "/api/v1/claim/start", {
    asset_type: "github_handle",
    asset_value: assetValue,
    ed25519_public_key_hex: signingPubHex,
    recovery_key_fingerprint: recoveryFingerprint,
  });
  if (start.status !== 201 || !start.body) {
    console.error(`\n✗ ASSERTION 1 FAIL: /claim/start returned ${start.status}`);
    console.error(`  body: ${start.text}`);
    if (start.status === 409) {
      console.error(
        `  → asset slot already taken. DELETE FROM claims WHERE asset_value='${assetValue}' from Neon, retry.`,
      );
    }
    process.exit(1);
  }
  console.log(`\n✓ ASSERTION 1: /claim/start → 201, claim_id=${start.body.claim_id}`);

  const { claim_id, agent_did, verification_code } = start.body;

  // ---- 2. Reach tier1 via Gist (interactive) ----
  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`  Create a PUBLIC GitHub Gist at https://gist.github.com`);
  console.log(`  under your @${assetValue} account containing:`);
  console.log(`    ${verification_code}`);
  console.log(`──────────────────────────────────────────────────────────────`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const gistUrl = (await rl.question("\nGist URL (https://gist.github.com/USER/ID): ")).trim();
  rl.close();

  const verify = await http<ClaimVerifyResponse>("POST", "/api/v1/claim/verify-gist", {
    claim_id,
    gist_url: gistUrl,
  });
  if (verify.status !== 200 || !verify.body || !("tier" in verify.body)) {
    console.error(`\n✗ ASSERTION 2 FAIL: /claim/verify-gist did not reach tier=1`);
    console.error(`  status=${verify.status}, body=${verify.text}`);
    process.exit(1);
  }
  const tierLeafIndex = verify.body.leaf_index;
  console.log(`✓ ASSERTION 2: /claim/verify-gist → tier=1, leaf_index=${tierLeafIndex}`);

  // ---- 3. Build revocation JWS, POST /claim/revoke (timed) ----
  const revocationTimestamp = new Date().toISOString();
  const revocationJws = buildRevocationJws(
    {
      did: agent_did,
      revoked_key_hex: signingPubHex,
      revocation_timestamp: revocationTimestamp,
      reason_code: "owner_request",
    },
    recovery.privateKey,
    recovery.publicKey,
  );

  const revoke = await http<ClaimRevokeResponse>("POST", "/api/v1/claim/revoke", {
    claim_id,
    revocation_record_jws: revocationJws,
  });

  // ---- Assertion 3: /claim/revoke 200 + revoked=true ----
  if (revoke.status !== 200 || !revoke.body || !("revoked" in revoke.body)) {
    console.error(`\n✗ ASSERTION 3 FAIL: /claim/revoke returned ${revoke.status}`);
    console.error(`  body: ${revoke.text}`);
    process.exit(1);
  }
  console.log(
    `✓ ASSERTION 3: /claim/revoke → 200, revoked=true, leaf_index=${revoke.body.leaf_index}`,
  );

  // ---- Assertion 4: leaf_index = N+1 ----
  const expectedRevocationLeafIndex = tierLeafIndex + 1;
  if (revoke.body.leaf_index !== expectedRevocationLeafIndex) {
    console.error(
      `\n✗ ASSERTION 4 FAIL: revocation leaf_index=${revoke.body.leaf_index}, expected ${expectedRevocationLeafIndex} (tier1 was at ${tierLeafIndex})`,
    );
    process.exit(1);
  }
  console.log(`✓ ASSERTION 4: revocation leaf at N+1 (index ${revoke.body.leaf_index})`);

  // ---- Assertion 5: re-claim with DIFFERENT keypair → 201 (asset freed) ----
  const newSigning = generateKeypair();
  const reclaim = await http<ClaimStartResponse>("POST", "/api/v1/claim/start", {
    asset_type: "github_handle",
    asset_value: assetValue,
    ed25519_public_key_hex: hex(newSigning.publicKey),
    recovery_key_fingerprint: recoveryFingerprint, // same recovery key for simplicity
  });
  if (reclaim.status !== 201 || !reclaim.body) {
    console.error(
      `\n✗ ASSERTION 5 FAIL: re-claim with different keypair returned ${reclaim.status}`,
    );
    console.error(`  body: ${reclaim.text}`);
    if (reclaim.status === 409) {
      console.error(`  → 409 means the partial unique index is still seeing the old row.`);
      console.error(`    Delete-on-revoke should have removed it; investigate revoke handler.`);
    }
    process.exit(1);
  }
  console.log(
    `✓ ASSERTION 5: re-claim same asset_value with different ed25519 keypair → 201 (claim_id=${reclaim.body.claim_id})`,
  );

  // ---- Assertion 6: wall-clock ≤ budget ----
  const elapsedMs = revoke.elapsedMs;
  if (elapsedMs > wallClockBudgetMs) {
    console.error(
      `\n✗ ASSERTION 6 FAIL: /claim/revoke took ${elapsedMs.toFixed(1)}ms (budget ${wallClockBudgetMs}ms)`,
    );
    console.error(`  → advisory-lock contention or non-Postgres await sneaked into the tx body.`);
    console.error(`    Inspect apps/api logs + apps/api/src/claim/revocation-committer.ts.`);
    process.exit(1);
  }
  console.log(
    `✓ ASSERTION 6: /claim/revoke wall-clock = ${elapsedMs.toFixed(1)}ms (budget ${wallClockBudgetMs}ms)`,
  );

  // ---- Artifact ----
  const today = new Date().toISOString().slice(0, 10);
  const outDir = join(REPO_ROOT, "ops", "bench-results");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${today}-first-live-revocation.txt`);

  const block = [
    `# Foxbook first live Tier-1 revocation`,
    `# ${new Date().toISOString()}`,
    ``,
    `asset_value:                    ${assetValue}`,
    `agent_did:                      ${agent_did}`,
    `revoked_claim_id:               ${claim_id}`,
    `revoked_signing_key:            ${signingPubHex}`,
    `recovery_key_fingerprint:       ${recoveryFingerprint}`,
    ``,
    `# Tier-1 leaf (registration)`,
    `tier1_leaf_index:               ${tierLeafIndex}`,
    `tier1_root_after:               ${"root_after" in verify.body ? verify.body.root_after : "?"}`,
    ``,
    `# Revocation leaf`,
    `revocation_leaf_index:          ${revoke.body.leaf_index}`,
    `revocation_leaf_hash:           ${revoke.body.leaf_hash}`,
    `revocation_sth_jws:             ${revoke.body.sth_jws}`,
    `revocation_timestamp:           ${revocationTimestamp}`,
    `revocation_wall_clock_ms:       ${elapsedMs.toFixed(1)}`,
    `revocation_wall_clock_budget:   ${wallClockBudgetMs}`,
    ``,
    `# Re-claim proof (asset slot freed by delete-on-revoke)`,
    `reclaim_claim_id:               ${reclaim.body.claim_id}`,
    `reclaim_agent_did:              ${reclaim.body.agent_did}`,
    `reclaim_signing_key:            ${hex(newSigning.publicKey)}`,
    ``,
  ].join("\n");

  writeFileSync(outFile, block);

  console.log(`\n✓ all six assertions passed.`);
  console.log(`  → ${outFile}`);
  console.log(`\n  Note: the re-claim is at gist_pending; it stays there unless you run`);
  console.log(`  smoke:tier1 to drive it through verify-gist (separate Gist post).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
