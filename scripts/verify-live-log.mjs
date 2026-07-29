#!/usr/bin/env node
// End-to-end correctness probe for the live transparency log.
//
// The uptime workflow checks that /root and /inclusion return HTTP 200.
// That is liveness, not correctness: a log can serve 200 on every endpoint
// while emitting a signed tree head that no one can verify — which is
// exactly what happened between the 2026-06-01 append and 2026-07-29,
// undetected for 58 days, because nothing on the monitoring path ever
// checked a signature.
//
// This probe runs what an actual integrator runs:
//
//   1. GET /.well-known/foxbook.json     → log_signing_public_key_hex
//   2. GET /root                         → STH (rootHash, leafCount, sthJws)
//   3. verify the STH JWS Ed25519 signature against the advertised key
//   4. check the signed payload's root_hash/tree_size match the served ones
//   5. GET /inclusion/:i                 → proof for a leaf
//   6. reconstruct the root per RFC 9162 §2.1.1 and compare to the SIGNED root
//
// Deliberately implemented with zero @foxbook imports. A probe that shares
// an implementation with the thing it audits cannot detect that
// implementation being wrong. Node builtins only — no install step, so this
// runs in CI without touching the workspace.
//
// Exit 0 = the log is verifiable by a third party right now.
// Exit 1 = it is not. That is an outage of the core guarantee, even when
//          every endpoint is returning 200.
//
// Usage: node scripts/verify-live-log.mjs [--api <base>] [--worker <base>] [--leaf <n>]

import { createHash, webcrypto } from "node:crypto";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const API_BASE = argOf("--api", "https://api.foxbook.dev").replace(/\/+$/, "");
const WORKER_BASE = argOf("--worker", "https://transparency.foxbook.dev").replace(/\/+$/, "");
const LEAF_INDEX = Number(argOf("--leaf", "1"));

const failures = [];
const ok = (m) => console.log(`✓ ${m}`);
const fail = (m) => {
  console.log(`✗ ${m}`);
  failures.push(m);
};

// ---- RFC 9162 §2.1 primitives (independent reimplementation) ----

const sha256 = (buf) => new Uint8Array(createHash("sha256").update(buf).digest());

/** SHA-256(0x01 || left || right). */
function interiorHash(left, right) {
  const buf = new Uint8Array(65);
  buf[0] = 0x01;
  buf.set(left, 1);
  buf.set(right, 33);
  return sha256(buf);
}

function largestPow2LessThan(n) {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/** RFC 9162 §2.1.1 root reconstruction from an inclusion path. */
function reconstruct(proof, m, leafHashBytes, n) {
  if (n === 1) return proof.length === 0 ? leafHashBytes : null;
  const sibling = proof[proof.length - 1];
  if (!sibling) return null;
  const rest = proof.slice(0, -1);
  const k = largestPow2LessThan(n);
  if (m < k) {
    const left = reconstruct(rest, m, leafHashBytes, k);
    return left === null ? null : interiorHash(left, sibling);
  }
  const right = reconstruct(rest, m - k, leafHashBytes, n - k);
  return right === null ? null : interiorHash(sibling, right);
}

const hexToBytes = (h) => Uint8Array.from(Buffer.from(h, "hex"));
const toHex = (b) => Buffer.from(b).toString("hex");
const b64uToBytes = (s) =>
  Uint8Array.from(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---- probe ----

console.log(`api=${API_BASE}  worker=${WORKER_BASE}  leaf=${LEAF_INDEX}\n`);

// 1. advertised signing key
let publicKeyHex;
try {
  const wk = await getJson(`${API_BASE}/.well-known/foxbook.json`);
  publicKeyHex = wk.log_signing_public_key_hex;
  if (typeof publicKeyHex !== "string" || publicKeyHex.length !== 64) {
    fail(`/.well-known/foxbook.json: log_signing_public_key_hex missing or not 32 bytes`);
  } else {
    ok(`/.well-known/foxbook.json advertises key ${publicKeyHex.slice(0, 16)}…`);
  }
} catch (e) {
  fail(`/.well-known/foxbook.json unreachable: ${e.message}`);
}

// 2. STH
let sth;
try {
  sth = await getJson(`${WORKER_BASE}/root`);
  ok(`/root → leafCount=${sth.leafCount} publishedAt=${sth.publishedAt}`);
} catch (e) {
  fail(`/root unreachable: ${e.message}`);
}

// 3-4. STH signature + payload agreement
let signedRootHash;
let signedTreeSize;
if (sth?.sthJws && publicKeyHex) {
  const parts = String(sth.sthJws).split(".");
  if (parts.length !== 3) {
    fail(`STH JWS is not a compact JWS (${parts.length} segments)`);
  } else {
    const [h, p, s] = parts;
    let header;
    let payload;
    try {
      header = JSON.parse(Buffer.from(b64uToBytes(h)).toString("utf8"));
      payload = JSON.parse(Buffer.from(b64uToBytes(p)).toString("utf8"));
    } catch (e) {
      fail(`STH JWS header/payload not JSON: ${e.message}`);
    }

    if (header && header.alg !== "EdDSA") {
      fail(`STH JWS alg is "${header.alg}", expected "EdDSA" (algorithm downgrade)`);
    }

    if (payload) {
      signedRootHash = payload.root_hash;
      signedTreeSize = payload.tree_size;

      let verified = false;
      try {
        const key = await webcrypto.subtle.importKey(
          "raw",
          hexToBytes(publicKeyHex),
          { name: "Ed25519" },
          false,
          ["verify"],
        );
        verified = await webcrypto.subtle.verify(
          { name: "Ed25519" },
          key,
          b64uToBytes(s),
          Buffer.from(`${h}.${p}`, "utf8"),
        );
      } catch (e) {
        fail(`STH signature check threw: ${e.message}`);
      }

      if (verified) {
        ok(`STH JWS signature verifies against the advertised key`);
      } else {
        fail(
          `STH JWS signature does NOT verify against the advertised key — ` +
            `the key at /.well-known is not the key that signed this STH ` +
            `(signing key rotated without re-signing, or wrong secret deployed). ` +
            `No third party can verify this log.`,
        );
      }

      if (signedRootHash !== sth.rootHash) {
        fail(`served rootHash ${sth.rootHash} != signed root_hash ${signedRootHash}`);
      } else {
        ok(`served rootHash matches the signed payload`);
      }
      if (Number(signedTreeSize) !== Number(sth.leafCount)) {
        fail(`served leafCount ${sth.leafCount} != signed tree_size ${signedTreeSize}`);
      } else {
        ok(`served leafCount matches the signed payload`);
      }
    }
  }
}

// 5-6. inclusion proof reconstructed against the SIGNED root
if (sth && Number(sth.leafCount) > LEAF_INDEX) {
  try {
    const inc = await getJson(`${WORKER_BASE}/inclusion/${LEAF_INDEX}`);
    const expected = signedRootHash ?? inc.rootHex;
    const root = reconstruct(
      inc.proofHex.map(hexToBytes),
      inc.leafIndex,
      hexToBytes(inc.leafHash),
      Number(inc.treeSize),
    );
    if (root === null) {
      fail(`leaf ${LEAF_INDEX}: inclusion proof did not reconstruct (malformed path)`);
    } else if (toHex(root) !== expected) {
      fail(`leaf ${LEAF_INDEX}: reconstructed root ${toHex(root)} != ${expected}`);
    } else {
      ok(`leaf ${LEAF_INDEX}: inclusion proof reconstructs to the signed root`);
    }
  } catch (e) {
    fail(`/inclusion/${LEAF_INDEX} failed: ${e.message}`);
  }
} else if (sth) {
  console.log(`- skipped inclusion check: leaf ${LEAF_INDEX} beyond leafCount ${sth.leafCount}`);
}

console.log("");
if (failures.length > 0) {
  console.log(`FAIL — ${failures.length} check(s) failed. The log is not third-party verifiable.`);
  process.exit(1);
}
console.log("PASS — the live log is verifiable by a third party.");
