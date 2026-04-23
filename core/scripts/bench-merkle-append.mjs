#!/usr/bin/env node

// Local throughput bench for core Merkle appendLeaf. NOT CI — takes a
// few seconds and writes results to ops/bench-results/*.csv so the
// series is queryable in git over time. Run on the same laptop before
// comparing cross-run.
//
// What this measures: pure TS tree math (SHA-256 + right-edge fold +
// per-leaf state clone). It does NOT include DB round-trips — that's
// a separate on-staging benchmark once we have real Neon access. The
// 50ms-at-100rps SLA in PROJECT-PLAN.md Day-4 is end-to-end; this
// bench isolates the in-process component. If the in-process p99 ever
// approaches 50ms, the Go-daemon signal in foundation §11.2 fires
// immediately — don't micro-optimize TS first.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256 } from "@noble/hashes/sha2.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");

// Inline the Merkle primitives — keeps the bench a single-file script
// with no build step. Kept byte-for-byte in sync with core/src/merkle
// (drift is caught by the test suite, which uses the TS module
// directly).
const EMPTY_TREE_ROOT = sha256(new Uint8Array(0));
const textEncoder = new TextEncoder();

function leafHash(preimage) {
  const buf = new Uint8Array(1 + preimage.length);
  buf[0] = 0x00;
  buf.set(preimage, 1);
  return sha256(buf);
}

function interiorHash(left, right) {
  const buf = new Uint8Array(65);
  buf[0] = 0x01;
  buf.set(left, 1);
  buf.set(right, 33);
  return sha256(buf);
}

function appendLeaf(state, preimage) {
  const lh = leafHash(preimage);
  let h = lh;
  let height = 0;
  const next = [...state.rightEdge];
  while (next.length > 0 && next[next.length - 1].height === height) {
    const top = next.pop();
    h = interiorHash(top.hash, h);
    height += 1;
  }
  next.push({ hash: h, height });
  return {
    state: { rightEdge: next, leafCount: state.leafCount + 1 },
    rootAfter: foldRoot(next),
  };
}

function foldRoot(rightEdge) {
  if (rightEdge.length === 0) return EMPTY_TREE_ROOT;
  let acc = rightEdge[rightEdge.length - 1].hash;
  for (let i = rightEdge.length - 2; i >= 0; i--) {
    acc = interiorHash(rightEdge[i].hash, acc);
  }
  return acc;
}

// Bench parameters
const N = 10_000;
const WARMUP = 500;
const LEAF_PREIMAGE = textEncoder.encode(
  // Representative of an agent-key-registration leaf payload size.
  JSON.stringify({
    leaf_type: "agent-key-registration",
    did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
    ed25519_public_key_hex: "a".repeat(64),
    recovery_key_fingerprint: `sha256:${"c".repeat(64)}`,
    published_at: "2026-04-23T10:00:00Z",
  }),
);

// Warmup — JIT + any one-time costs
let state = { rightEdge: [], leafCount: 0 };
for (let i = 0; i < WARMUP; i++) state = appendLeaf(state, LEAF_PREIMAGE).state;

// Measured run
const durations = new Array(N);
state = { rightEdge: [], leafCount: 0 };
for (let i = 0; i < N; i++) {
  const t0 = performance.now();
  state = appendLeaf(state, LEAF_PREIMAGE).state;
  durations[i] = performance.now() - t0;
}

durations.sort((a, b) => a - b);
const percentile = (p) => durations[Math.min(N - 1, Math.floor((N * p) / 100))];
const p50 = percentile(50);
const p95 = percentile(95);
const p99 = percentile(99);
const mean = durations.reduce((a, b) => a + b, 0) / N;

// Derive a crude throughput estimate. Single-threaded, no DB.
const totalMs = durations.reduce((a, b) => a + b, 0);
const throughputPerSec = (N / totalMs) * 1000;

const runIso = new Date().toISOString();
const row = [
  runIso,
  N,
  p50.toFixed(4),
  p95.toFixed(4),
  p99.toFixed(4),
  mean.toFixed(4),
  throughputPerSec.toFixed(0),
  process.platform,
  process.arch,
  process.version,
].join(",");

const outDir = join(REPO_ROOT, "ops", "bench-results");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const today = runIso.slice(0, 10); // YYYY-MM-DD
const outFile = join(outDir, `${today}-merkle-append.csv`);
const header =
  "run_iso,n,p50_ms,p95_ms,p99_ms,mean_ms,throughput_per_sec,platform,arch,node_version\n";

if (!existsSync(outFile)) {
  writeFileSync(outFile, header);
}
appendFileSync(outFile, `${row}\n`);

console.log(`✓ bench:merkle-append — ${N} iters`);
console.log(`    p50: ${p50.toFixed(4)} ms`);
console.log(`    p95: ${p95.toFixed(4)} ms`);
console.log(`    p99: ${p99.toFixed(4)} ms`);
console.log(`    mean: ${mean.toFixed(4)} ms`);
console.log(`    throughput: ${throughputPerSec.toFixed(0)} appends/sec (single-thread, no DB)`);
console.log(`    → ${outFile}`);

if (p99 > 50) {
  console.log("");
  console.log(
    "⚠ p99 >50 ms on core tree math alone — this is the Go-daemon signal per foundation §11.2.",
  );
  console.log("   Do NOT micro-optimize TS. File in PR body and escalate to week-2 decision.");
}
