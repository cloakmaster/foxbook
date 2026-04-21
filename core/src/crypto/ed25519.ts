import { sign as edSign, verify as edVerify, getPublicKey, hashes, utils } from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// @noble/ed25519 v3 ships sha512 unwired so browsers can pick subtle-crypto;
// Node doesn't, so we provide a sync sha512. Do this once at module load.
hashes.sha512 = sha512;

export type Ed25519Keypair = {
  /** 32-byte seed (RFC 8032 §5.1.5). */
  privateKey: Uint8Array;
  /** 32-byte public key. */
  publicKey: Uint8Array;
};

/** Derive a keypair from a 32-byte seed. Deterministic per RFC 8032. */
export function keypairFromSeed(seed: Uint8Array): Ed25519Keypair {
  if (seed.length !== 32) {
    throw new Error(`Ed25519 seed must be 32 bytes, got ${seed.length}`);
  }
  return {
    privateKey: seed,
    publicKey: getPublicKey(seed),
  };
}

/**
 * Fresh random keypair. Use for signing keys only — recovery keys are minted via
 * an offline controlled flow documented in docs/foundation/foxbook-foundation.md §6.6.
 */
export function generateKeypair(): Ed25519Keypair {
  return keypairFromSeed(utils.randomSecretKey());
}

/** Ed25519 detached signature over `message` using the 32-byte seed. */
export function sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return edSign(message, privateKey);
}

/** Verify an Ed25519 signature. Returns true iff valid. */
export function verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  return edVerify(signature, message, publicKey);
}
