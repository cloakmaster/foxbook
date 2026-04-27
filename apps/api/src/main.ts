import { verifyGistContainsCode } from "@foxbook/adapter-gist";
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

const port = Number(process.env.PORT ?? 8787);
const db = createNodeClient();

// Merkle log signing key — held by the API server. Set in .env.local
// via FOXBOOK_LOG_SIGNING_KEY_HEX (64 lowercase hex chars = 32-byte
// Ed25519 seed). If missing, the server still runs but any tier1
// append throws at runtime — a loud failure, not a silent zero-byte
// sign. See foundation §6.4 for key provenance.
const signingKeyHex = process.env.FOXBOOK_LOG_SIGNING_KEY_HEX;
const signingKey = signingKeyHex ? parseHex(signingKeyHex) : undefined;
if (!signingKey) {
  console.warn(
    "FOXBOOK_LOG_SIGNING_KEY_HEX is not set — claim-flow tier1 appends will throw. Set it in .env.local for full functionality.",
  );
}

const merkle = createMerkleRepository(db, signingKey ? { signingKey } : {});

// PR D: firehose listener over DATABASE_URL_DIRECT. Construction throws
// loud if the env var is missing or pooled — no silent fallback to
// DATABASE_URL. start() returns immediately; the connect-subscribe-
// heartbeat loop runs in the background. On clean shutdown (SIGTERM),
// the process exits naturally; the listener's persistent connection is
// torn down by Postgres-side. (Future: add an explicit shutdown hook
// when SSE clients accumulate enough that we want graceful drain —
// today single-subscriber, not load-bearing.)
const firehoseListener = createFirehoseListener();
firehoseListener.start();

const app = createApp({
  discoveryRepo: new DrizzleDiscoveryRepository(db),
  claim: {
    claimRepo: createClaimRepository(db),
    gist: { verifyGistContainsCode },
    verificationCommitter: createVerificationCommitter(db, merkle),
    revocationCommitter: createRevocationCommitter(db, merkle),
  },
  firehoseEmitter: firehoseListener.emitter,
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`foxbook-api listening on http://localhost:${info.port}`);
});
