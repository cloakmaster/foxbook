import { verifyGistContainsCode } from "@foxbook/adapter-gist";
import { createMerkleRepository, createNodeClient } from "@foxbook/db";
import { serve } from "@hono/node-server";

import { createClaimRepository } from "./claim/repository.js";
import { DrizzleDiscoveryRepository } from "./discover/repository.js";
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

const app = createApp({
  discoveryRepo: new DrizzleDiscoveryRepository(db),
  claim: {
    claimRepo: createClaimRepository(db),
    gist: { verifyGistContainsCode },
    merkle,
  },
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`foxbook-api listening on http://localhost:${info.port}`);
});
