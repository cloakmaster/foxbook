// Cloudflare Worker entry. Wires createEdgeClient + the Merkle
// repository into the Hono app defined in ./server.ts.
//
// The repo is instantiated per-request because @neondatabase/serverless
// is stateless HTTP — no pool to keep warm — and Workers routinely
// recycle globals between isolates. A per-request factory also keeps
// the Hono app swappable in tests without any global state.
//
// We pass NO signing key: this Worker only ever calls the read
// methods of MerkleRepository. Append throws at runtime if it's ever
// called here; that's the intended trip-wire.

import { createEdgeClient, createMerkleRepository } from "@foxbook/db";

import { createApp, type TransparencyEnv } from "./server.js";

const app = createApp((env: TransparencyEnv) => {
  const db = createEdgeClient(env.DATABASE_URL);
  // Read-only; signingKey intentionally omitted. Any `append` call
  // from this Worker throws — regression guard against accidental
  // writes from the edge surface.
  return createMerkleRepository(db, {});
});

export default {
  fetch: app.fetch,
};
