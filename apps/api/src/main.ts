import { EventEmitter } from "node:events";

import { verifyDnsTxtContainsCode } from "@foxbook/adapter-dns";
import { verifyEndpointSignedNonce } from "@foxbook/adapter-endpoint-challenge";
import { verifyGistContainsCode } from "@foxbook/adapter-gist";
import { keypairFromSeed } from "@foxbook/core";
import { createMerkleRepository, createNodeClient } from "@foxbook/db";
import { serve } from "@hono/node-server";

import { createClaimRepository } from "./claim/repository.js";
import { createRevocationCommitter } from "./claim/revocation-committer.js";
import { createVerificationCommitter } from "./claim/verification-committer.js";
import { DrizzleDiscoveryRepository } from "./discover/repository.js";
import { createFirehoseListener } from "./firehose/listener.js";
import { createApp } from "./server.js";

function parseHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) {
    const byte = b[i];
    if (byte === undefined) continue;
    s += byte.toString(16).padStart(2, "0");
  }
  return s;
}

const port = Number(process.env.PORT ?? 8787);
const db = createNodeClient();

// Merkle log signing key — held by the API server. Set via
// FOXBOOK_LOG_SIGNING_KEY_HEX (64 lowercase hex chars = 32-byte Ed25519
// seed). If missing, the server still runs but any tier1 append throws
// at runtime — loud failure, not a silent zero-byte sign.
const signingKeyHex = process.env.FOXBOOK_LOG_SIGNING_KEY_HEX;
const signingKey = signingKeyHex ? parseHex(signingKeyHex) : undefined;
if (!signingKey) {
  console.warn(
    "FOXBOOK_LOG_SIGNING_KEY_HEX is not set — claim-flow tier1 appends will throw. Set it in .env.local (dev) or `flyctl secrets set` (prod) for full functionality.",
  );
}

// Derive the public key for /.well-known/foxbook.json. Same Ed25519
// keypair the merkle log signs STHs with — re-implementations
// validate STH signatures against this hex.
const logSigningPublicKeyHex = signingKey
  ? bytesToHex(keypairFromSeed(signingKey).publicKey)
  : undefined;

const merkle = createMerkleRepository(db, signingKey ? { signingKey } : {});

// PR D: firehose listener over DATABASE_URL_DIRECT. Construction throws
// loud if the env var is missing or pooled — no silent fallback to
// DATABASE_URL. start() returns immediately; the connect-subscribe-
// heartbeat loop runs in the background. On clean shutdown (SIGTERM),
// the process exits naturally; the listener's persistent connection is
// torn down by Postgres-side. (Future: add an explicit shutdown hook
// when SSE clients accumulate enough that we want graceful drain —
// today single-subscriber, not load-bearing.)
//
// Gated on FOXBOOK_FIREHOSE_ENABLED ("true" enables; anything else disables).
// Disabled by default in production because the listener holds an open
// postgres LISTEN/NOTIFY connection 24/7, which consumes ~720
// compute-hours/month against Neon's free-tier 100-hour cap. With no
// documented external consumers of the SSE firehose surface, the
// always-on connection is pure waste. The /firehose route is still
// served when disabled, but receives no events — subscribers connect
// successfully and see only the SSE heartbeat ping. Re-enable by setting
// FOXBOOK_FIREHOSE_ENABLED=true via `flyctl secrets set` when a future
// integrator needs the firehose surface.
const firehoseEnabled = process.env.FOXBOOK_FIREHOSE_ENABLED === "true";
let firehoseEmitter: EventEmitter;
if (firehoseEnabled) {
  const firehoseListener = createFirehoseListener();
  firehoseListener.start();
  firehoseEmitter = firehoseListener.emitter;
  console.log("firehose_listener_enabled — FOXBOOK_FIREHOSE_ENABLED=true");
} else {
  console.log(
    "firehose_listener_disabled — set FOXBOOK_FIREHOSE_ENABLED=true to enable the postgres LISTEN/NOTIFY subscriber",
  );
  firehoseEmitter = new EventEmitter();
  firehoseEmitter.setMaxListeners(0); // SSE clients can be many
}

const app = createApp({
  discoveryRepo: new DrizzleDiscoveryRepository(db),
  claim: {
    claimRepo: createClaimRepository(db),
    gist: { verifyGistContainsCode },
    dns: { verifyDnsTxtContainsCode },
    endpoint: { verifyEndpointSignedNonce },
    verificationCommitter: createVerificationCommitter(db, merkle),
    revocationCommitter: createRevocationCommitter(db, merkle),
  },
  firehoseEmitter,
  merkleRepo: merkle,
  logSigningPublicKeyHex,
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`foxbook-api listening on http://localhost:${info.port}`);
});
