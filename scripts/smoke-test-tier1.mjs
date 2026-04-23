#!/usr/bin/env node

// Manual smoke-test helper for the Day-5 Tier-1 claim flow.
//
// Prereqs (you, from your terminal — not the agent):
//   1. `pnpm --filter @foxbook/db db:migrate` (applies Migrations 0001 + 0002 to dev).
//   2. `pnpm --filter @foxbook/api dev` running in a separate terminal.
//   3. FOXBOOK_LOG_SIGNING_KEY_HEX set in .env.local (64 lowercase hex chars).
//      Generate once with:  openssl rand -hex 32
//
// Usage:
//   pnpm smoke:tier1 --asset-value <your-github-handle>
//
// What this does:
//   1. Mints an ephemeral Ed25519 keypair (Node crypto; SPKI-DER → 32-byte raw
//      pub key hex). Prints the seed hex so you can reuse it if you want to
//      treat this as your real agent's first signing key; otherwise throw
//      away after the demo.
//   2. Mints a fake recovery-key seed + its sha256 fingerprint. Recovery-key
//      keygen is proper Day-6 work (foundation §6.6); this is smoke-test
//      scaffolding.
//   3. POSTs /api/v1/claim/start — prints the 32-char verification_code.
//   4. Waits for you to paste the public Gist URL after you create it.
//   5. POSTs /api/v1/claim/verify-gist — if the identity guard + code match
//      line up, you get back the first real inclusion proof + STH JWS.
//   6. Writes ops/bench-results/YYYY-MM-DD-first-live-append.txt with every
//      relevant artifact, for the week-1 retro.
//
// If anything 500s: check the API logs. The most likely cause is migration
// 0001 not applied (column "right_edge" does not exist). Roll the migration
// and retry — the smoke test is idempotent up to POST /claim/start (409 on
// asset conflict) and re-runnable if you haven't finalized the Gist.

import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return dflt;
  return args[i + 1];
}

const assetValue = arg("asset-value");
const assetType = arg("asset-type", "github_handle");
const apiBase = arg("api-base", "http://localhost:8787");

if (!assetValue) {
  console.error("");
  console.error("smoke-test-tier1 — Day-5 live Tier-1 exercise");
  console.error("");
  console.error("Usage:");
  console.error(
    "  pnpm smoke:tier1 --asset-value <github-handle> [--api-base http://localhost:8787]",
  );
  console.error("");
  console.error("Prereqs: pnpm --filter @foxbook/db db:migrate (dev) + apps/api running.");
  console.error("");
  process.exit(2);
}

// ---- Ed25519 keygen (Node crypto, no deps) --------------------------------
// SPKI-DER for Ed25519 is 44 bytes; the last 32 are the raw public key.

function mintEd25519() {
  const kp = generateKeyPairSync("ed25519");
  const spkiDer = kp.publicKey.export({ format: "der", type: "spki" });
  if (spkiDer.length !== 44) {
    throw new Error(`Ed25519 SPKI-DER expected 44 bytes, got ${spkiDer.length}`);
  }
  const rawPub = spkiDer.subarray(12); // 44 - 32 = 12-byte SPKI header
  const pkcs8Der = kp.privateKey.export({ format: "der", type: "pkcs8" });
  // PKCS8 Ed25519 private is a 48-byte blob ending in the 32-byte raw seed.
  const rawSeed = pkcs8Der.subarray(pkcs8Der.length - 32);
  return {
    publicKeyHex: rawPub.toString("hex"),
    seedHex: rawSeed.toString("hex"),
  };
}

// ---- Claim flow -----------------------------------------------------------

async function http(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response; keep text
  }
  return { status: res.status, body: json, text };
}

async function main() {
  console.log(`\n→ smoke test against ${apiBase}`);
  console.log(`  asset_type: ${assetType}`);
  console.log(`  asset_value: ${assetValue}`);

  const signing = mintEd25519();
  const recoverySeed = randomBytes(32);
  const recoveryFingerprint = `sha256:${createHash("sha256").update(recoverySeed).digest("hex")}`;

  console.log(`\n→ ephemeral Ed25519 keypair minted`);
  console.log(`  public_key_hex:  ${signing.publicKeyHex}`);
  console.log(`  seed_hex:        ${signing.seedHex}  (save this if you want to reuse)`);
  console.log(`\n→ fake recovery-key fingerprint: ${recoveryFingerprint}`);
  console.log(`  (recovery-key keygen is Day-6 work; this is smoke-test scaffolding)`);

  // POST /claim/start
  const start = await http("POST", "/api/v1/claim/start", {
    asset_type: assetType,
    asset_value: assetValue,
    ed25519_public_key_hex: signing.publicKeyHex,
    recovery_key_fingerprint: recoveryFingerprint,
  });

  if (start.status !== 201) {
    console.error(`\n✗ /claim/start returned ${start.status}`);
    console.error(`  body: ${start.text}`);
    if (start.status === 409) {
      console.error(
        `\n  409 means (${assetType}, ${assetValue}) is already claimed. Either delete that claim row or pick a different asset_value for the smoke test.`,
      );
    }
    if (start.status === 500) {
      console.error(
        `\n  500 is usually "column right_edge does not exist" — Migration 0001 not applied. Run:`,
      );
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

  // POST /claim/verify-gist
  const verify = await http("POST", "/api/v1/claim/verify-gist", {
    claim_id,
    gist_url: gistUrl,
  });

  console.log(`\n→ /claim/verify-gist → ${verify.status}`);
  console.log(`  body: ${JSON.stringify(verify.body, null, 2)}`);

  if (verify.status !== 200 || !verify.body || verify.body.tier !== 1) {
    console.error(`\n✗ verify did not reach tier=1 this round.`);
    if (verify.body?.status === "identity-mismatch") {
      console.error(
        `  → identity-mismatch means the Gist URL's owner segment doesn't match asset_value=${assetValue}. The identity guard caught it.`,
      );
    }
    if (verify.body?.status === "still-pending") {
      console.error(
        `  → still-pending means the Gist was fetched but didn't contain the code. Check the Gist content + re-run this script.`,
      );
    }
    if (verify.body?.status === "not-found") {
      console.error(
        `  → not-found means the Gist URL returned 404. Double-check the URL (gist.github.com, not github.com).`,
      );
    }
    process.exit(1);
  }

  const { leaf_index, leaf_hash, root_after, sth_jws } = verify.body;

  // Write the artifact
  const today = new Date().toISOString().slice(0, 10);
  const outDir = join(REPO_ROOT, "ops", "bench-results");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${today}-first-live-append.txt`);

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
    `ed25519_public_key:  ${signing.publicKeyHex}`,
    `ed25519_seed:        ${signing.seedHex}`,
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
    `# Run this against the transparency Worker to independently verify:`,
    `#   curl \${WORKER_URL}/root`,
    `#   curl \${WORKER_URL}/leaf/${leaf_index}`,
    `#   curl \${WORKER_URL}/inclusion/${leaf_index}`,
    ``,
  ].join("\n");

  if (existsSync(outFile)) {
    // Append with a separator — multiple runs on the same day are expected.
    appendFileSync(outFile, `\n\n────────────────────────────────\n\n${block}`);
  } else {
    writeFileSync(outFile, block);
  }

  console.log(`\n✓ first live Tier-1 Merkle append captured.`);
  console.log(`  leaf_index:  ${leaf_index}`);
  console.log(`  root_after:  ${root_after}`);
  console.log(`  → ${outFile}`);
  console.log(`\n  Week-1 retro artifact — keep it. Reference it in docs/retros/week-01.md.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
