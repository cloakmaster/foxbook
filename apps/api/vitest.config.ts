import { defineConfig } from "vitest/config";

// The DB transaction-atomicity integration suites
// (__tests__/*.tx*.test.ts) all append to the SAME shared merkle log
// (transparency_log / tl_leaves) in a single live Postgres. Each test
// snapshots the leaf count, performs one append, then asserts the count
// moved by exactly +1 (or stayed put on rollback). Those deltas are only
// deterministic if no other suite appends concurrently.
//
// Vitest's default file-level parallelism runs the two integration files
// in separate workers at the same time, so their appends interleave and
// the leaf-count assertions race (observed: ~1-in-5 "expected 2 to be 1").
//
// Disable file parallelism ONLY when the integration suites are actually
// enabled (RUN_INTEGRATION_TESTS=1 — the CI `integration` job and local
// runs against a real DB). The default unit-test run (flag unset) keeps
// full parallelism, so `pnpm test` stays fast and unchanged.
const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "1";

export default defineConfig({
  test: {
    fileParallelism: !integrationEnabled,
  },
});
