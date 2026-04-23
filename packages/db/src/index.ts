export { createDbClient, type DbClient } from "./client.js";
export {
  createMerkleRepository,
  type MerkleAppendResult,
  type MerkleConsistencyProof,
  type MerkleInclusionProof,
  type MerkleRepository,
  type MerkleRepositoryOptions,
  type MerkleRootSnapshot,
} from "./merkle-repository.js";
export * as schema from "./schema/index.js";
