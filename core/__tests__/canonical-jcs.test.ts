// Byte-match interop test: our RFC 8785 canonicalizer (canonicalJcsBytes)
// vs the CTEF v0.3.1 reference at agentgraph.co/.well-known/cte-test-vectors.json.
//
// Two test surfaces:
//   1. Offline (always runs in CI): reads the cached fixture at
//      __tests__/fixtures/ctef-v0.3.1.json (snapshot from
//      2026-04-30T10:51Z) and asserts SHA-256(canonicalJcsBytes(input))
//      matches the published canonical_sha256 for all 4 vectors.
//   2. Live (gated on RUN_LIVE_TESTS=1): re-fetches the published doc,
//      diffs against the fixture. Catches upstream drift so we know to
//      bump the fixture + report.
//
// Companion artifact:
//   ops/evidence/2026-04-30-ctef-v0.3.1-byte-match.md
//   — public-facing report with the per-vector results.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { canonicalJcsBytes } from "../src/crypto/jcs.js";
import { sha256Hex } from "../src/crypto/sha256.js";

const FIXTURE_PATH = fileURLToPath(
  new URL("./fixtures/ctef-v0.3.1.json", import.meta.url),
);

type CtefVector = {
  description: string;
  input_object: Record<string, unknown>;
  canonical_bytes_utf8: string;
  canonical_sha256: string;
  expected_result: "pass" | "fail-closed";
  expected_error_code?: string;
};

type CtefDoc = {
  version: string;
  spec: string;
  contract: { canonicalization: string; hash_algorithm: string };
  envelope_vector: CtefVector;
  verdict_vector: CtefVector;
  scope_violation_vector: CtefVector;
  composition_failure_vector: CtefVector;
};

function loadFixture(): CtefDoc {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  return JSON.parse(raw) as CtefDoc;
}

function checkVector(name: string, vec: CtefVector) {
  const ourBytes = canonicalJcsBytes(vec.input_object);
  const ourString = new TextDecoder().decode(ourBytes);
  const ourSha = sha256Hex(ourBytes);

  // Byte-exact canonical bytes.
  expect(ourString, `${name}: canonical bytes byte-mismatch`).toBe(
    vec.canonical_bytes_utf8,
  );
  // SHA-256-exact.
  expect(ourSha, `${name}: SHA-256 mismatch`).toBe(vec.canonical_sha256);
}

describe("CTEF v0.3.1 byte-match (canonicalJcsBytes vs published vectors)", () => {
  const doc = loadFixture();

  it("fixture pins CTEF v0.3.1 + RFC 8785 + SHA-256", () => {
    expect(doc.version).toBe("0.3.1");
    expect(doc.spec).toBe("CTEF (Composable Trust Evidence Format)");
    expect(doc.contract.canonicalization).toBe("RFC 8785 (JSON Canonicalization Scheme)");
    expect(doc.contract.hash_algorithm).toBe("SHA-256");
  });

  it("envelope_vector byte-match (positive, claim_type=authority)", () => {
    checkVector("envelope_vector", doc.envelope_vector);
  });

  it("verdict_vector byte-match (positive, EnforcementVerdict)", () => {
    checkVector("verdict_vector", doc.verdict_vector);
  });

  it("scope_violation_vector byte-match (negative-shape, INVALID_CLAIM_SCOPE)", () => {
    checkVector("scope_violation_vector", doc.scope_violation_vector);
    expect(doc.scope_violation_vector.expected_error_code).toBe("INVALID_CLAIM_SCOPE");
  });

  it("composition_failure_vector byte-match (negative-shape, INVALID_COMPOSITION)", () => {
    checkVector("composition_failure_vector", doc.composition_failure_vector);
    expect(doc.composition_failure_vector.expected_error_code).toBe("INVALID_COMPOSITION");
  });
});

describe.skipIf(!process.env.RUN_LIVE_TESTS)(
  "CTEF v0.3.1 live fetch (RUN_LIVE_TESTS=1)",
  () => {
    it("fixture stays in sync with the live published doc", async () => {
      const res = await fetch("https://agentgraph.co/.well-known/cte-test-vectors.json");
      expect(res.status).toBe(200);
      const live = (await res.json()) as CtefDoc;

      // Spec identity must not drift.
      expect(live.version).toBe("0.3.1");

      // Per-vector hashes match the fixture (drift detector).
      const fixture = loadFixture();
      expect(live.envelope_vector.canonical_sha256).toBe(
        fixture.envelope_vector.canonical_sha256,
      );
      expect(live.verdict_vector.canonical_sha256).toBe(
        fixture.verdict_vector.canonical_sha256,
      );
      expect(live.scope_violation_vector.canonical_sha256).toBe(
        fixture.scope_violation_vector.canonical_sha256,
      );
      expect(live.composition_failure_vector.canonical_sha256).toBe(
        fixture.composition_failure_vector.canonical_sha256,
      );
    });

    it("our canonicalizer still byte-matches against live", async () => {
      const res = await fetch("https://agentgraph.co/.well-known/cte-test-vectors.json");
      const live = (await res.json()) as CtefDoc;
      checkVector("envelope_vector(live)", live.envelope_vector);
      checkVector("verdict_vector(live)", live.verdict_vector);
      checkVector("scope_violation_vector(live)", live.scope_violation_vector);
      checkVector("composition_failure_vector(live)", live.composition_failure_vector);
    });
  },
);
