// Merkle transparency-log repository. Single persistence boundary for
// the Merkle primitives in core/src/merkle. Every `append` runs inside
// one BEGIN/COMMIT guarded by a per-log_id advisory lock — N API
// instances may call append concurrently; Postgres serialises them
// through the lock, and the two-insert window (tl_leaves +
// transparency_log) is atomic with the lock hold.
//
// Why a single transaction: the two inserts define one STH. If they
// committed independently, the window between them would be a
// root-corruption window — a reader catching the tl_leaves row before
// the transparency_log row would see a leaf with no signed root, and
// a crashed writer between them would leave the log permanently
// out-of-sync with its roots. One BEGIN/COMMIT eliminates both.
//
// Why advisory-lock and not SERIALIZABLE: contention is on one log_id.
// pg_advisory_xact_lock on hashtext('foxbook-v1') is a narrow,
// cheap, targeted lock; SERIALIZABLE would be an over-broad fallback
// if advisory ever exhibits a pooler quirk we can't work around.
//
// The right-edge state is cached on transparency_log.right_edge (jsonb)
// so this append is O(log n) in compute and O(log n) in DB bytes —
// the additive migration in 0001_merkle_right_edge.sql is what makes
// that possible (ADR 0002, forward-only additive).

import { canonicalJsonBytes, jwsSign, merkle } from "@foxbook/core";
import { sql } from "drizzle-orm";

import type { DbClient } from "./client.js";
import * as schema from "./schema/index.js";

const DEFAULT_LOG_ID = "foxbook-v1";
const STH_VERSION = "1.0-draft";

type RightEdgeRow = { hash: string; height: number };

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function encodeRightEdge(entries: merkle.RightEdgeEntry[]): RightEdgeRow[] {
  return entries.map((e) => ({ hash: hex(e.hash), height: e.height }));
}

function decodeRightEdge(rows: RightEdgeRow[] | null | undefined): merkle.RightEdgeEntry[] {
  if (!rows) return [];
  return rows.map((r) => ({ hash: fromHex(r.hash), height: r.height }));
}

/**
 * Sign an STH over a canonical JSON payload. The payload shape is the
 * single authoritative surface — any change here is a JWS-breaking
 * change, so every verifier (TS, Python, future Go daemon) that
 * reconstructs the signing input must use the same key order.
 */
function signTreeHead(
  privateKey: Uint8Array,
  logId: string,
  treeSize: number,
  rootHash: Uint8Array,
  timestamp: string,
): string {
  // Key order below is load-bearing: core/src/crypto/canonical.ts
  // preserves insertion order. TS and Python both produce the same
  // byte stream for this literal.
  const payload = {
    log_id: logId,
    tree_size: treeSize,
    root_hash: hex(rootHash),
    timestamp,
    version: STH_VERSION,
  };
  // canonicalJsonBytes is exported by @foxbook/core/crypto; jwsSign
  // routes through the same helper. Duplication here is intentional:
  // the silent consumer of canonicalJsonBytes is anyone hashing this
  // same payload shape — e.g. a second Foxbook verifier that checks
  // the signing input byte-for-byte.
  void canonicalJsonBytes;
  return jwsSign({ alg: "EdDSA", typ: "JWT" }, payload, privateKey);
}

export type MerkleAppendResult = {
  leafIndex: number;
  leafHash: string;
  rootAfter: string;
  sthJws: string;
  publishedAt: Date;
};

export type MerkleRootSnapshot = {
  rootHash: string;
  leafCount: number;
  publishedAt: Date;
  sthJws: string;
};

export type MerkleInclusionProof = {
  leafHash: string;
  leafIndex: number;
  treeSize: number;
  proofHex: string[];
  rootHex: string;
};

export type MerkleConsistencyProof = {
  oldSize: number;
  newSize: number;
  proofHex: string[];
};

export type MerkleRepositoryOptions = {
  /** Log identifier. Single log in V1; value is `foxbook-v1`. */
  logId?: string;
  /**
   * Ed25519 signing key (32-byte seed). Held by the caller — key
   * management is NOT a Merkle-log concern and is intentionally kept
   * out of packages/db. See foundation §6.4 / §6.6 for where these
   * keys come from in the claim flow.
   *
   * Optional so read-only consumers (the transparency.foxbook.dev
   * Cloudflare Worker) can instantiate the repository without holding
   * a signing key. `append` throws at runtime if called without one —
   * no silent zero-byte signing. The read methods
   * (getRoot / getLeaf / getInclusionProof / getConsistencyProof)
   * never touch the signing key.
   */
  signingKey?: Uint8Array;
};

export type MerkleRepository = {
  append: (leafData: unknown) => Promise<MerkleAppendResult>;
  getRoot: () => Promise<MerkleRootSnapshot | null>;
  getLeaf: (
    index: number,
  ) => Promise<{ leafIndex: number; leafHash: string; leafData: unknown; appendedAt: Date } | null>;
  getInclusionProof: (index: number) => Promise<MerkleInclusionProof>;
  getConsistencyProof: (oldSize: number, newSize: number) => Promise<MerkleConsistencyProof>;
};

export function createMerkleRepository(
  db: DbClient,
  opts: MerkleRepositoryOptions,
): MerkleRepository {
  const logId = opts.logId ?? DEFAULT_LOG_ID;

  async function append(leafData: unknown): Promise<MerkleAppendResult> {
    if (!opts.signingKey) {
      throw new Error(
        "MerkleRepository.append requires an Ed25519 signingKey in opts. Read-only consumers (the transparency Worker) must not call append.",
      );
    }
    const signingKey = opts.signingKey;
    return await db.transaction(async (tx) => {
      // Per-log_id advisory lock: cheap, released atomically on COMMIT.
      // hashtext() maps the log_id string to a stable 32-bit int so
      // two processes agree on the same lock slot. SERIALIZABLE is the
      // documented fallback if this ever hits a pooler quirk.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${logId}))`);

      // Load prior STH (if any) for this log. We only need the last
      // row — ORDER BY leaf_count DESC LIMIT 1 returns null on first
      // append. Reading inside the locked transaction means we're
      // looking at committed state at lock-grant time.
      const prior = await tx
        .select({
          leafCount: schema.transparencyLog.leafCount,
          rightEdge: schema.transparencyLog.rightEdge,
        })
        .from(schema.transparencyLog)
        .where(sql`${schema.transparencyLog.logId} = ${logId}`)
        .orderBy(sql`${schema.transparencyLog.leafCount} DESC`)
        .limit(1);

      const priorState: merkle.TreeState =
        prior.length === 0
          ? merkle.emptyTree()
          : {
              rightEdge: decodeRightEdge(prior[0]?.rightEdge as RightEdgeRow[] | null),
              leafCount: Number(prior[0]?.leafCount),
            };

      // Hash the canonical leaf preimage. We hash canonicalJsonBytes
      // so leaf equality is content-hash, not jsonb-value-shape (jsonb
      // reorders keys on insert). Any downstream consumer verifying a
      // leaf's inclusion must recompute leaf_hash the same way.
      const preimage = canonicalJsonBytes(leafData);
      const { state: nextState, leafIndex, rootAfter } = merkle.appendLeaf(priorState, preimage);
      const lh = merkle.leafHash(preimage);

      const publishedAt = new Date();
      const sthJws = signTreeHead(
        signingKey,
        logId,
        nextState.leafCount,
        rootAfter,
        publishedAt.toISOString(),
      );

      await tx.insert(schema.tlLeaves).values({
        leafIndex: BigInt(leafIndex),
        leafHash: hex(lh),
        leafData,
        appendedAt: publishedAt,
      });

      await tx.insert(schema.transparencyLog).values({
        logId,
        rootHash: hex(rootAfter),
        leafCount: BigInt(nextState.leafCount),
        signedTreeHead: sthJws,
        rightEdge: encodeRightEdge(nextState.rightEdge),
        publishedAt,
      });

      return {
        leafIndex,
        leafHash: hex(lh),
        rootAfter: hex(rootAfter),
        sthJws,
        publishedAt,
      };
    });
  }

  async function getRoot(): Promise<MerkleRootSnapshot | null> {
    const rows = await db
      .select({
        rootHash: schema.transparencyLog.rootHash,
        leafCount: schema.transparencyLog.leafCount,
        publishedAt: schema.transparencyLog.publishedAt,
        signedTreeHead: schema.transparencyLog.signedTreeHead,
      })
      .from(schema.transparencyLog)
      .where(sql`${schema.transparencyLog.logId} = ${logId}`)
      .orderBy(sql`${schema.transparencyLog.leafCount} DESC`)
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      rootHash: r.rootHash,
      leafCount: Number(r.leafCount),
      publishedAt: r.publishedAt,
      sthJws: r.signedTreeHead,
    };
  }

  async function getLeaf(index: number) {
    const rows = await db
      .select()
      .from(schema.tlLeaves)
      .where(sql`${schema.tlLeaves.leafIndex} = ${BigInt(index)}`)
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      leafIndex: Number(r.leafIndex),
      leafHash: r.leafHash,
      leafData: r.leafData,
      appendedAt: r.appendedAt,
    };
  }

  // Read-path uses stored tl_leaves.leaf_hash directly — never re-hashes
  // from tl_leaves.leaf_data jsonb. Postgres jsonb reorders object keys
  // on storage (by key length, then ASCIIbetically), so re-serializing
  // the jsonb produces different bytes than the insert-time preimage →
  // different hash → proofs that fail to verify against the stored
  // root. Our own Day-4 comment on the write path warned about this;
  // the read path previously fell into the trap anyway. Fixed by
  // operating on already-hashed leaves via merkle.*FromLeafHashes(),
  // which matches how the tree is actually persisted.
  async function readAllLeafHashes(size: number): Promise<Uint8Array[]> {
    const rows = await db
      .select({ leafIndex: schema.tlLeaves.leafIndex, leafHash: schema.tlLeaves.leafHash })
      .from(schema.tlLeaves)
      .where(sql`${schema.tlLeaves.leafIndex} < ${BigInt(size)}`)
      .orderBy(sql`${schema.tlLeaves.leafIndex} ASC`);
    if (rows.length !== size) {
      throw new Error(
        `expected ${size} leaves in tl_leaves but found ${rows.length} — integrity gap`,
      );
    }
    return rows.map((r) => fromHex(r.leafHash));
  }

  async function getInclusionProof(index: number): Promise<MerkleInclusionProof> {
    const root = await getRoot();
    if (root === null) throw new Error("log is empty — no inclusion proof available");
    if (index < 0 || index >= root.leafCount) {
      throw new Error(`inclusion proof index out of range: ${index} not in [0, ${root.leafCount})`);
    }
    const leafHashes = await readAllLeafHashes(root.leafCount);
    const proof = merkle.inclusionProofFromLeafHashes(leafHashes, index);
    const lh = leafHashes[index];
    if (!lh) throw new Error(`unreachable: leaf at index ${index} missing after size check`);
    return {
      leafHash: hex(lh),
      leafIndex: index,
      treeSize: root.leafCount,
      proofHex: proof.map((p) => hex(p)),
      // rootHex comes from the stored STH at the sampled leafCount,
      // not a recomputation — so the proof is verifiable against the
      // exact root the Worker serves at /root.
      rootHex: root.rootHash,
    };
  }

  async function getConsistencyProof(
    oldSize: number,
    newSize: number,
  ): Promise<MerkleConsistencyProof> {
    if (oldSize < 0 || newSize < 0 || oldSize > newSize) {
      throw new Error(
        `consistency proof requires 0 <= oldSize <= newSize, got ${oldSize} <= ${newSize}`,
      );
    }
    const leafHashes = await readAllLeafHashes(newSize);
    const proof = merkle.consistencyProofFromLeafHashes(leafHashes, oldSize);
    return {
      oldSize,
      newSize,
      proofHex: proof.map((p) => hex(p)),
    };
  }

  return { append, getRoot, getLeaf, getInclusionProof, getConsistencyProof };
}
