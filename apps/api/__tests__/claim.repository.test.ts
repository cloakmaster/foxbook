// Repository-layer tests for createClaimRepository — specifically the
// translation of Postgres unique-violation errors into the
// {ok: false, status: "asset-conflict"} discriminated result.
//
// Why: handler-layer tests in claim.test.ts use a stubbed repo that
// returns asset-conflict directly, so the live error-translation path
// in repository.ts wasn't exercised. Day-6 dev-DB hit revealed that
// Drizzle (>= 0.44) wraps postgres-js errors in DrizzleQueryError with
// the actual SQLSTATE at e.cause.code — the previous catch only
// looked at e.code, so 23505 fell through and Hono returned a 500
// instead of a clean 409 asset-conflict. This file exercises both
// shapes so the fix doesn't silently regress.

import { describe, expect, it } from "vitest";

import type { NodeDbClient } from "@foxbook/db";
import { createClaimRepository, isUniqueViolation } from "../src/claim/repository.js";

function dbThrowing(error: unknown): NodeDbClient {
  // Minimal fake — only the call chain insertClaim exercises:
  // db.insert(...).values(...).returning(...).
  return {
    insert: () => ({
      values: () => ({
        returning: () => Promise.reject(error),
      }),
    }),
  } as unknown as NodeDbClient;
}

const sampleRow = {
  agentDid: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
  state: "gist_pending" as const,
  assetType: "github_handle" as const,
  assetValue: "cloakmaster",
  ed25519PublicKeyHex: "f".repeat(64),
  recoveryKeyFingerprint: "sha256:" + "a".repeat(64),
  verificationCode: "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH",
};

describe("isUniqueViolation", () => {
  it("matches a top-level error with code 23505", () => {
    const err = Object.assign(new Error("dup"), { code: "23505" });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("matches a DrizzleQueryError-shaped wrapper with cause.code 23505", () => {
    const inner = Object.assign(new Error("PostgresError"), { code: "23505" });
    const outer = Object.assign(new Error("Failed query"), {
      name: "DrizzleQueryError",
      cause: inner,
    });
    expect(isUniqueViolation(outer)).toBe(true);
  });

  it("matches a doubly-wrapped error (cause.cause.code 23505)", () => {
    const innermost = Object.assign(new Error("inner"), { code: "23505" });
    const middle = new Error("middle");
    (middle as unknown as { cause: unknown }).cause = innermost;
    const outer = new Error("outer");
    (outer as unknown as { cause: unknown }).cause = middle;
    expect(isUniqueViolation(outer)).toBe(true);
  });

  it("does NOT match a different SQLSTATE (e.g. 23502 not_null_violation)", () => {
    const err = Object.assign(new Error("nn"), { code: "23502" });
    expect(isUniqueViolation(err)).toBe(false);
  });

  it("does NOT match a plain Error with no code", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });

  it("does NOT match null / undefined / primitives", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(23505)).toBe(false);
  });

  it("terminates on circular cause chains", () => {
    const a = new Error("a");
    const b = new Error("b");
    (a as unknown as { cause: unknown }).cause = b;
    (b as unknown as { cause: unknown }).cause = a;
    // No 23505 anywhere — depth limit prevents infinite loop.
    expect(isUniqueViolation(a)).toBe(false);
  });
});

describe("createClaimRepository.insertClaim — error translation", () => {
  it("returns asset-conflict on a top-level postgres-js 23505", async () => {
    const err = Object.assign(new Error("dup"), { code: "23505" });
    const repo = createClaimRepository(dbThrowing(err));
    const r = await repo.insertClaim(sampleRow);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe("asset-conflict");
  });

  it("returns asset-conflict on a Drizzle-wrapped 23505 (cause chain)", async () => {
    // This is the exact shape Drizzle 0.45.x produces in dev — the
    // regression that made smoke:tier1 return 500 instead of 409.
    const inner = Object.assign(new Error("PostgresError"), {
      code: "23505",
      detail: "Key (asset_type, asset_value)=(github_handle, cloakmaster) already exists.",
      constraint_name: "claims_asset_uniq_idx",
    });
    const wrapped = Object.assign(new Error("Failed query: insert into claims..."), {
      name: "DrizzleQueryError",
      cause: inner,
    });
    const repo = createClaimRepository(dbThrowing(wrapped));
    const r = await repo.insertClaim(sampleRow);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe("asset-conflict");
  });

  it("re-throws non-unique-violation errors (e.g. connection failure)", async () => {
    const err = new Error("ECONNREFUSED");
    const repo = createClaimRepository(dbThrowing(err));
    await expect(repo.insertClaim(sampleRow)).rejects.toThrow("ECONNREFUSED");
  });

  it("re-throws Drizzle-wrapped non-23505 errors", async () => {
    const inner = Object.assign(new Error("not null violation"), { code: "23502" });
    const wrapped = Object.assign(new Error("Failed query"), {
      name: "DrizzleQueryError",
      cause: inner,
    });
    const repo = createClaimRepository(dbThrowing(wrapped));
    await expect(repo.insertClaim(sampleRow)).rejects.toThrow();
  });
});
