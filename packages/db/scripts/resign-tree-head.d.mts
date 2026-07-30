// Type declarations for the dependency-free recovery script.
//
// The script itself is plain .mjs on purpose (see its header: a recovery
// tool must run when the workspace doesn't build). These declarations
// exist so resign-sth-parity.test.ts — which proves the script's signer
// is byte-identical to @foxbook/core's — can import it under `tsc`.

import type { KeyObject } from "node:crypto";

export declare const STH_VERSION: "1.0-draft";

export declare function keypairFromSeed(seed: Uint8Array): {
  privateKey: KeyObject;
  publicKeyRaw: Buffer;
};

export declare function jwsSign(
  protectedHeader: Record<string, unknown>,
  payload: Record<string, unknown>,
  seed: Uint8Array,
): string;

export declare function jwsVerifyRaw(token: string, publicKeyRaw: Uint8Array): boolean;

export declare function sthPayload(
  logId: string,
  treeSize: number,
  rootHashHex: string,
  timestampIso: string,
): {
  log_id: string;
  tree_size: number;
  root_hash: string;
  timestamp: string;
  version: string;
};
