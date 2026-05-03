# Verify a Foxbook claim in 60 seconds

The Foxbook transparency log is live, public, and unauthenticated. Anyone can verify any claim's history without asking for an API key, account, or commercial relationship. This page walks the simplest end-to-end verification: open a shell, run three curls, see the protocol working.

## What you're verifying

Foxbook records agent identity claims as leaves in an RFC 9162-shaped Merkle transparency log. Each leaf is content-hashed, included in a Merkle tree, and the root of that tree is signed in a Signed Tree Head (STH). To verify a claim:

1. Read the latest STH (`/root`) to know the current tree root + size.
2. Read the inclusion proof for a specific leaf (`/inclusion/:i`) — the path of sibling hashes from the leaf up to the root.
3. Reconstruct the root from the leaf hash + the inclusion proof. If the reconstructed root matches the served root byte-for-byte, the leaf is provably included.

The protocol is the same shape Chrome uses to verify TLS certificate transparency. Anyone with internet access can do this. There is no "trust the server" step.

## Step 1 — read the latest STH

```bash
curl -s https://transparency.foxbook.dev/root
```

Expected response (formatted; the live response is single-line JSON):

```json
{
  "rootHash": "<64-char hex>",
  "leafCount": <integer ≥ 1>,
  "publishedAt": "<ISO-8601 timestamp>",
  "sthJws": "<compact-JWS, header.payload.signature>"
}
```

`rootHash` is the Merkle root of the entire log at the moment the request hits. `sthJws` is an Ed25519 JWS over `{log_id, tree_size, root_hash, timestamp, version}` signed with the log's signing key (public key at `/.well-known/foxbook.json`).

Important headers: `Cache-Control: no-store`. The STH is always fresh (per [ADR 0007](decisions/0007-http-cache-and-read-write-split.md)).

## Step 2 — read an inclusion proof

The first claim ever recorded is at leaf index 1. Verify it:

```bash
curl -s https://transparency.foxbook.dev/inclusion/1
```

Expected response (formatted):

```json
{
  "leafHash": "<64-char hex>",
  "leafIndex": 1,
  "treeSize": <integer; the tree size when this proof was sampled>,
  "proofHex": ["<sibling hash 1>", "<sibling hash 2>", ...],
  "rootHex": "<64-char hex>"
}
```

`proofHex` is the array of sibling hashes you need to walk from `leafHash` (at index 1) up to the root. `rootHex` is what those hashes should reconstruct to.

Cache: `Cache-Control: public, max-age=31536000, immutable` — once a leaf is at index N, its inclusion-proof at that tree size is byte-identical forever, so the proof is safely cached for a year.

## Step 3 — reconstruct the root

You have:

- `leafHash` (the bytes that get hashed up the tree)
- `proofHex` (the sibling hashes)
- `treeSize` (which tree this proof refers to)
- `rootHex` (what you should reconstruct)

The reconstruction algorithm is RFC 9162 §2.1.1. The reference implementation is in `core/src/merkle/tree.ts` as `verifyInclusion(proof, leafIndex, leafHash, treeSize, expectedRoot)`.

Easiest path: use the SDK.

```bash
npm install @foxbook/sdk-claim
```

```typescript
import { verify } from "@foxbook/sdk-claim";

const result = await verify({ leaf_index: 1 });
console.log(result);
// { valid: true, leaf_index: 1, root_hex: "...", leaf_hash: "..." }
```

If `result.valid === true`, you've cryptographically proven that leaf 1 is included in the current Foxbook transparency log. No trust-the-server step.

For a higher-level "is this AgentCard real" check:

```typescript
import { verifyAgentCard } from "@foxbook/sdk-claim";

const result = await verifyAgentCard(card, { asset_type: "github_handle" });
if (result.status !== "verified") {
  // block, log, fall through to your risk policy
  return;
}
// result.verified_signing_key_hex is the agent's active signing key —
// you can verify the AgentCard's JWS signature against it directly.
```

## Cross-language verification

The same proof verifies in any language. Test vectors at [`schemas/crypto-test-vectors.json`](../schemas/crypto-test-vectors.json) keep cross-implementation byte-match parity. The CTEF v0.3.1 byte-match report at [`ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md`](../ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md) is the durable artifact for cross-spec interop validation.

## The four outcomes

`verifyAgentCard` returns one of four discriminated results. There is no numeric trust score and no reputation field. Identity (objective, cryptographic) is kept separate from reputation (subjective).

| Outcome | Meaning | Mapping |
|---|---|---|
| `verified` | Card's handle is in the log AND inclusion proof reconstructs cleanly | allowed |
| `unverified` | Handle not in the log OR inclusion proof failed | blocked (or retry — see `reason_code`) |
| `handle-mismatch` | Card claims a DID that's different from what the log attests for the handle | blocked |
| `stale-proof` | The STH used is older than the freshness threshold the caller required | warning (caller decides — refresh, retry, accept) |

The `unverified` branch carries an optional structured `reason_code` (`handle-not-claimed` / `inclusion-proof-failed` / `key-not-yet-logged` / `card-malformed`) so callers can distinguish retry-decisionable from hard-block.

## Troubleshooting

- **`/root` returns 5xx**: Cloudflare Worker is occasionally redeployed. Retry after 30 seconds. If it persists, see [OPERATIONS.md](OPERATIONS.md).
- **`/inclusion/:i` returns 404**: the leaf index doesn't exist yet (try `i = 0` or smaller; current leaf count is in `/root` response).
- **SDK reports `inclusion proof failed`**: the served root and the reconstructed root don't match — this would be a real protocol violation and worth filing as a security issue at `hello@foxbook.dev`.

## Going deeper

- The full RFC: [`docs/rfc-a2a-x-foxbook-extension.md`](rfc-a2a-x-foxbook-extension.md).
- Why Foxbook is shaped this way: [`docs/RATIONALE.md`](RATIONALE.md).
- Architecture decisions: [`docs/decisions/`](decisions/).
- Operational runbook: [`docs/OPERATIONS.md`](OPERATIONS.md).
