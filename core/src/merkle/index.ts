// Merkle transparency-log primitives. RFC 9162 binary tree over SHA-256.
// Pure functions, no storage. The DB-side repository lives in
// packages/db/src/merkle-repository.ts.

export * from "./hash.js";
export * from "./tree.js";
