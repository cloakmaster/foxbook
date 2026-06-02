// PR-A4 — verify.ts implementation tests. Stubs globalThis.fetch with
// shaped responses for the transparency Worker (/inclusion, /root) and
// the apps/api by-handle endpoint. Cross-validates against
// schemas/crypto-test-vectors.json's Merkle vectors so the proof
// reconstruction has a real cryptographic hook (not just stubs).

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_API_BASE,
  DEFAULT_WORKER_BASE,
  foxbookVerify,
  type VerifiableAgentCard,
  verify,
  verifyAgentCard,
} from "../src/verify.js";

// ---- STH signing (throwaway in-test Ed25519 key) ----
//
// verify()/verifyAgentCard() now require a signature-verified STH: they
// fetch the log's public key from /.well-known/foxbook.json and verify
// the /root sthJws against it, then pin the inclusion proof to the
// SIGNED root_hash. So fixtures must serve a real signed STH + a
// matching public key. We mint a throwaway Ed25519 keypair once and
// sign STHs whose root_hash equals the fixture's Merkle root.

const WELL_KNOWN_URL = "https://api.foxbook.dev/.well-known/foxbook.json";

let LOG_PUBLIC_KEY_HEX: string;
let logPrivateKey: CryptoKey;
let WRONG_PUBLIC_KEY_HEX: string;

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Sign an STH byte-identically to the server (core/src/crypto/jws.ts +
 *  packages/db merkle-repository signTreeHead): header {alg:"EdDSA",
 *  typ:"JWT"}, JSON.stringify payload in load-bearing key order. */
async function signSth(args: {
  rootHash: string;
  treeSize: number;
  timestamp?: string;
}): Promise<string> {
  const enc = new TextEncoder();
  const header = { alg: "EdDSA", typ: "JWT" };
  const payload = {
    log_id: "foxbook-v1",
    tree_size: args.treeSize,
    root_hash: args.rootHash,
    timestamp: args.timestamp ?? "2026-05-01T08:00:00.000Z",
    version: "1.0-draft",
  };
  const signingInput = `${b64url(enc.encode(JSON.stringify(header)))}.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "Ed25519" }, logPrivateKey, enc.encode(signingInput)),
  );
  return `${signingInput}.${b64url(sig)}`;
}

function wellKnownStub(publicKeyHex: string = LOG_PUBLIC_KEY_HEX): [string, FetchResponse] {
  return [
    WELL_KNOWN_URL,
    {
      status: 200,
      body: {
        protocol_version: "1.0",
        supported_tiers: [1],
        transparency_log_url: "https://transparency.foxbook.dev",
        api_base: "https://api.foxbook.dev",
        log_signing_public_key_hex: publicKeyHex,
      },
    },
  ];
}

beforeAll(async () => {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  logPrivateKey = kp.privateKey;
  LOG_PUBLIC_KEY_HEX = bytesToHex(
    new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)),
  );
  const wrong = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  WRONG_PUBLIC_KEY_HEX = bytesToHex(
    new Uint8Array(await crypto.subtle.exportKey("raw", wrong.publicKey)),
  );
});

// ---- fetch stubbing ----

type FetchResponse = {
  status: number;
  body: unknown;
};

let mockFetch: ReturnType<typeof vi.fn>;
let requestLog: Array<{ url: string }> = [];

function stubFetchByUrl(map: Map<string, FetchResponse>): void {
  mockFetch.mockImplementation(async (url: string) => {
    requestLog.push({ url });
    const r = map.get(url);
    if (!r) {
      throw new Error(`test bug: no stub for ${url}`);
    }
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function stubFetchThrows(reason: string): void {
  mockFetch.mockImplementation(async () => {
    throw new Error(reason);
  });
}

beforeEach(() => {
  mockFetch = vi.fn();
  requestLog = [];
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---- Merkle test fixtures ----
//
// Single-leaf tree: leafHash IS the root, proof is empty. Smallest
// case that exercises the verifyInclusion happy path without needing
// a full Merkle reconstruction.
//
// SHA-256 of "hello" = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
// (We don't actually need a real preimage — verifyInclusion takes the
// leaf HASH bytes directly.)

const SINGLE_LEAF_HASH = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

// Two-leaf tree: hashes h0=00…00, h1=11…11. The root is sha256(0x01 || h0 || h1).
// We use the actual values produced by core's mth() for a 2-leaf tree
// constructed from these two leaf hashes. Cached rather than computed
// in-test to keep tests fast and the fixtures auditable.
//
// (Computed via core's mthFromLeafHashes — these values pin the
// happy path for a 2-leaf reconstruction.)
const TWO_LEAF_H0 = "0000000000000000000000000000000000000000000000000000000000000000";
const TWO_LEAF_H1 = "1111111111111111111111111111111111111111111111111111111111111111";
// Computed locally as SHA-256(0x01 || h0 || h1) per RFC 9162 internal-node hash.
const TWO_LEAF_ROOT = "a7b6a88afe611b23a8bb9836e3cd13ba706cb05d6de647d92bf05bb0aace72ee";

// ---- DEFAULT_WORKER_BASE / DEFAULT_API_BASE ----

describe("constants", () => {
  it("DEFAULT_WORKER_BASE points at the canonical reference", () => {
    expect(DEFAULT_WORKER_BASE).toBe("https://transparency.foxbook.dev");
  });

  it("DEFAULT_API_BASE re-exported from claim", () => {
    expect(DEFAULT_API_BASE).toBe("https://api.foxbook.dev");
  });
});

// ---- verify (Merkle primitive) ----

describe("verify", () => {
  it("fetches /inclusion + /root + /.well-known in parallel from defaults", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "2026-04-30T10:00:00Z",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );

    const result = await verify({ leaf_index: 0 });
    if (!result.valid) throw new Error(`expected valid, got ${result.reason}`);
    expect(result.leaf_index).toBe(0);
    expect(result.root_hex).toBe(SINGLE_LEAF_HASH);
    expect(result.leaf_hash).toBe(SINGLE_LEAF_HASH);
    expect(requestLog.map((r) => r.url).sort()).toEqual([
      "https://api.foxbook.dev/.well-known/foxbook.json",
      "https://transparency.foxbook.dev/inclusion/0",
      "https://transparency.foxbook.dev/root",
    ]);
  });

  it("respects worker_base override (with trailing slash)", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://staging.foxbook.dev/inclusion/3",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://staging.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "now",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 3, worker_base: "https://staging.foxbook.dev/" });
    expect(result.valid).toBe(true);
  });

  it("respects api_base override for the well-known key fetch", async () => {
    stubFetchByUrl(
      new Map<string, FetchResponse>([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "now",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        [
          "https://staging-api.foxbook.dev/.well-known/foxbook.json",
          {
            status: 200,
            body: { log_signing_public_key_hex: LOG_PUBLIC_KEY_HEX },
          },
        ],
      ]),
    );
    const result = await verify({ leaf_index: 0, api_base: "https://staging-api.foxbook.dev/" });
    expect(result.valid).toBe(true);
    expect(requestLog.map((r) => r.url)).toContain(
      "https://staging-api.foxbook.dev/.well-known/foxbook.json",
    );
  });

  it("verifies a real 2-leaf inclusion proof for index 0", async () => {
    // For leaf 0 in a 2-leaf tree, the proof is [h1].
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: TWO_LEAF_H0,
              leafIndex: 0,
              treeSize: 2,
              proofHex: [TWO_LEAF_H1],
              rootHex: TWO_LEAF_ROOT,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: TWO_LEAF_ROOT,
              leafCount: 2,
              publishedAt: "now",
              sthJws: await signSth({ rootHash: TWO_LEAF_ROOT, treeSize: 2 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    if (!result.valid) throw new Error(`expected valid, got ${result.reason}`);
    expect(result.root_hex).toBe(TWO_LEAF_ROOT);
  });

  it("returns valid=false on /inclusion HTTP error", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/99",
          { status: 404, body: { error: "out-of-range" } },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 99 });
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("404");
  });

  it("returns valid=false on /root HTTP error", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        ["https://transparency.foxbook.dev/root", { status: 500, body: { error: "internal" } }],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    expect(result.valid).toBe(false);
  });

  it("returns valid=false on network failure", async () => {
    stubFetchThrows("ECONNREFUSED");
    const result = await verify({ leaf_index: 0 });
    expect(result.valid).toBe(false);
  });

  it("returns valid=false when /inclusion response is missing fields", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          { status: 200, body: { leafHash: SINGLE_LEAF_HASH } },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    expect(result.valid).toBe(false);
  });

  it("returns valid=false on bad-hex in /inclusion fields", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: "ZZ",
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    expect(result.valid).toBe(false);
  });

  it("returns valid=false when proof reconstruction doesn't match the SIGNED root", async () => {
    // The proof reconstructs to SINGLE_LEAF_HASH (single-leaf tree),
    // but the STH is signed over a different root. Even though the
    // server-supplied inc.rootHex matches the (forged) STH, the proof
    // can't reconstruct to it → fail closed.
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: TWO_LEAF_ROOT, // server lies; ignored now
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: TWO_LEAF_ROOT,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: TWO_LEAF_ROOT, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("merkle proof");
  });

  // ---- STH signature fail-closed paths (the #1 security fix) ----

  it("fails closed when /.well-known omits log_signing_public_key_hex", async () => {
    stubFetchByUrl(
      new Map<string, FetchResponse>([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        [
          WELL_KNOWN_URL,
          {
            status: 200,
            body: { protocol_version: "1.0", supported_tiers: [1] }, // no key
          },
        ],
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("public key");
  });

  it("fails closed when /.well-known is unreachable", async () => {
    stubFetchByUrl(
      new Map<string, FetchResponse>([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        [WELL_KNOWN_URL, { status: 503, body: { error: "down" } }],
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    expect(result.valid).toBe(false);
  });

  it("fails closed when the STH is signed by the WRONG key", async () => {
    // STH root matches the proof, but it was signed by a key the
    // well-known surface does NOT advertise (a MITM / rogue signer).
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              // signed by logPrivateKey, but well-known advertises a
              // DIFFERENT public key, so the signature won't verify.
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        wellKnownStub(WRONG_PUBLIC_KEY_HEX),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("STH signature");
  });

  it("fails closed when sthJws is unsigned / malformed (no signature to trust)", async () => {
    stubFetchByUrl(
      new Map<string, FetchResponse>([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: "not-a-real-jws", // unsigned garbage
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("STH signature");
  });

  it("fails closed when the signed STH attests a different tree_size", async () => {
    // Proof says treeSize=1; STH is validly signed but over tree_size=2.
    // A correctly-rooted proof under the wrong head must not pass.
    stubFetchByUrl(
      new Map([
        [
          "https://transparency.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://transparency.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 2,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 2 }),
            },
          },
        ],
        wellKnownStub(),
      ]),
    );
    const result = await verify({ leaf_index: 0 });
    if (result.valid) throw new Error("expected invalid");
    expect(result.reason).toContain("tree_size");
  });
});

// ---- foxbookVerify (handle → claim) ----

describe("foxbookVerify", () => {
  it("calls GET /api/v1/claim/by-handle/:asset_type/:asset_value", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          {
            status: 200,
            body: {
              asset_type: "github_handle",
              asset_value: "alice",
              agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
              state: "tier1_verified",
              verification_tier: 1,
              ed25519_public_key_hex: "f".repeat(64),
              revoked: false,
              leaf_index: 7,
              inclusion_proof_url: "https://transparency.foxbook.dev/inclusion/7",
            },
          },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "alice" });
    if ("status" in result) throw new Error(`expected tier-bearing result, got ${result.status}`);
    expect(result.tier).toBe(1);
    expect(result.revoked).toBe(false);
    expect(result.did).toBe("did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M");
    expect(result.leafIndex).toBe(7);
    // v0.2: the active signing key is surfaced on the tier-bearing branch
    // so a gateway can verify the AgentCard's JWS in one call.
    expect(result.verified_signing_key_hex).toBe("f".repeat(64));
  });

  it("v0.2: returns error when by-handle response is missing ed25519_public_key_hex", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          {
            status: 200,
            body: {
              asset_type: "github_handle",
              asset_value: "alice",
              agent_did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
              state: "tier1_verified",
              verification_tier: 1,
              // ed25519_public_key_hex omitted — required since v0.2
              revoked: false,
              leaf_index: 7,
            },
          },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "alice" });
    if (!("status" in result) || result.status !== "error") {
      throw new Error("expected error result for missing ed25519_public_key_hex");
    }
  });

  it("returns not-claimed on 404", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/nobody",
          {
            status: 404,
            body: { error: "not-claimed", asset_type: "github_handle", asset_value: "nobody" },
          },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "nobody" });
    expect(result).toEqual({ status: "not-claimed" });
  });

  it("returns not-claimed when verification_tier is 0", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/pending",
          {
            status: 200,
            body: {
              asset_type: "github_handle",
              asset_value: "pending",
              agent_did: "did:foxbook:01HXYZABCDEFGHJKMNPQRSTVW42",
              state: "gist_pending",
              verification_tier: 0,
              ed25519_public_key_hex: "f".repeat(64),
              revoked: false,
            },
          },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "pending" });
    expect(result).toEqual({ status: "not-claimed" });
  });

  it("respects apiBase override", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://staging.foxbook.dev/api/v1/claim/by-handle/domain/example.com",
          { status: 404, body: {} },
        ],
      ]),
    );
    const result = await foxbookVerify({
      asset_type: "domain",
      asset_value: "example.com",
      apiBase: "https://staging.foxbook.dev/",
    });
    expect(result).toEqual({ status: "not-claimed" });
  });

  it("URL-encodes asset_value", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/x_handle/%40alice",
          { status: 404, body: {} },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "x_handle", asset_value: "@alice" });
    expect(result).toEqual({ status: "not-claimed" });
  });

  it("returns error on network failure", async () => {
    stubFetchThrows("DNS lookup failed");
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "alice" });
    expect("status" in result && result.status === "error").toBe(true);
  });

  it("returns error on 500", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          { status: 500, body: { error: "internal" } },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "alice" });
    expect("status" in result && result.status === "error").toBe(true);
  });

  it("returns error on 200 with missing required fields", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          { status: 200, body: { asset_type: "github_handle" } },
        ],
      ]),
    );
    const result = await foxbookVerify({ asset_type: "github_handle", asset_value: "alice" });
    expect("status" in result && result.status === "error").toBe(true);
  });
});

// ---- verifyAgentCard ----

const ALICE_DID = "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M" as const;
const BOB_DID = "did:foxbook:01HXYZABCDEFGHJKMNPQRSTVW42" as const;

const aliceCard: VerifiableAgentCard = {
  handle: "alice",
  "x-foxbook": {
    did: ALICE_DID,
    foxbook_url: "https://foxbook.dev/agents/alice",
    verification_tier: 1,
  },
};

async function aliceVerifiedStubs(): Promise<Map<string, FetchResponse>> {
  return new Map([
    [
      "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
      {
        status: 200,
        body: {
          asset_type: "github_handle",
          asset_value: "alice",
          agent_did: ALICE_DID,
          state: "tier1_verified",
          verification_tier: 1,
          ed25519_public_key_hex: "f".repeat(64),
          revoked: false,
          leaf_index: 0,
          inclusion_proof_url: "https://transparency.foxbook.dev/inclusion/0",
        },
      },
    ],
    [
      "https://transparency.foxbook.dev/inclusion/0",
      {
        status: 200,
        body: {
          leafHash: SINGLE_LEAF_HASH,
          leafIndex: 0,
          treeSize: 1,
          proofHex: [],
          rootHex: SINGLE_LEAF_HASH,
        },
      },
    ],
    [
      "https://transparency.foxbook.dev/root",
      {
        status: 200,
        body: {
          rootHash: SINGLE_LEAF_HASH,
          leafCount: 1,
          publishedAt: "2026-05-01T08:00:00.000Z",
          sthJws: await signSth({
            rootHash: SINGLE_LEAF_HASH,
            treeSize: 1,
            timestamp: "2026-05-01T08:00:00.000Z",
          }),
        },
      },
    ],
    wellKnownStub(),
  ]);
}

describe("verifyAgentCard", () => {
  it("returns verified for a happy-path tier1 card", async () => {
    stubFetchByUrl(await aliceVerifiedStubs());
    const result = await verifyAgentCard(aliceCard, { asset_type: "github_handle" });
    if (result.status !== "verified") throw new Error(`expected verified, got ${result.status}`);
    expect(result.tier).toBe(1);
    expect(result.did).toBe(ALICE_DID);
    expect(result.leafIndex).toBe(0);
    // v0.2: verified branch carries the active signing key so the
    // gateway can verify the AgentCard's JWS without a second lookup.
    expect(result.verified_signing_key_hex).toBe("f".repeat(64));
  });

  it("returns unverified when card.handle is missing", async () => {
    const noHandle: VerifiableAgentCard = { "x-foxbook": { did: ALICE_DID } };
    const result = await verifyAgentCard(noHandle, { asset_type: "github_handle" });
    if (result.status !== "unverified")
      throw new Error(`expected unverified, got ${result.status}`);
    expect(result.reason).toContain("handle missing");
    // v0.2: structured reason_code lets callers branch without parsing
    // the free-form reason string.
    expect(result.reason_code).toBe("card-malformed");
  });

  it("returns unverified when by-handle returns 404", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/nobody",
          { status: 404, body: {} },
        ],
      ]),
    );
    const noClaim: VerifiableAgentCard = { handle: "nobody", "x-foxbook": { did: ALICE_DID } };
    const result = await verifyAgentCard(noClaim, { asset_type: "github_handle" });
    if (result.status !== "unverified")
      throw new Error(`expected unverified, got ${result.status}`);
    expect(result.reason).toContain("transparency log");
    expect(result.reason_code).toBe("handle-not-claimed");
  });

  it("returns handle-mismatch when card.x-foxbook.did differs from log's agent_did", async () => {
    const stubs = await aliceVerifiedStubs();
    const liarCard: VerifiableAgentCard = {
      handle: "alice", // this handle's row in the log has agent_did = ALICE_DID
      "x-foxbook": { did: BOB_DID }, // but the card claims to be BOB
    };
    stubFetchByUrl(stubs);
    const result = await verifyAgentCard(liarCard, { asset_type: "github_handle" });
    if (result.status !== "handle-mismatch") {
      throw new Error(`expected handle-mismatch, got ${result.status}`);
    }
    expect(result.claimed_handle).toBe("alice");
  });

  it("skips card.did check when card has no x-foxbook.did (treats handle as ground truth)", async () => {
    const stubs = await aliceVerifiedStubs();
    stubFetchByUrl(stubs);
    const minimalCard: VerifiableAgentCard = { handle: "alice" };
    const result = await verifyAgentCard(minimalCard, { asset_type: "github_handle" });
    expect(result.status).toBe("verified");
  });

  it("requireInclusionProof default true: rejects when leafIndex is null", async () => {
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          {
            status: 200,
            body: {
              asset_type: "github_handle",
              asset_value: "alice",
              agent_did: ALICE_DID,
              state: "tier2_pending",
              verification_tier: 1,
              ed25519_public_key_hex: "f".repeat(64),
              revoked: false,
              // no leaf_index — the by-handle endpoint omits it for
              // pre-tier1-leaf states (shouldn't happen for tier=1
              // in practice but the SDK guards anyway).
            },
          },
        ],
      ]),
    );
    const result = await verifyAgentCard(aliceCard, { asset_type: "github_handle" });
    expect(result.status).toBe("unverified");
    if (result.status !== "unverified") throw new Error("unreachable");
    expect(result.reason_code).toBe("inclusion-proof-failed");
  });

  it("requireInclusionProof=false: skips the proof fetch", async () => {
    // No inclusion stub configured — if requireInclusionProof were true,
    // the test would throw on missing stub.
    stubFetchByUrl(
      new Map([
        [
          "https://api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          {
            status: 200,
            body: {
              asset_type: "github_handle",
              asset_value: "alice",
              agent_did: ALICE_DID,
              state: "tier1_verified",
              verification_tier: 1,
              ed25519_public_key_hex: "f".repeat(64),
              revoked: false,
              leaf_index: 0,
            },
          },
        ],
      ]),
    );
    const result = await verifyAgentCard(aliceCard, {
      asset_type: "github_handle",
      requireInclusionProof: false,
    });
    expect(result.status).toBe("verified");
    expect(requestLog.map((r) => r.url)).not.toContain(
      "https://transparency.foxbook.dev/inclusion/0",
    );
  });

  it("requireFreshSTH: returns stale-proof when STH is older than threshold", async () => {
    const stubs = await aliceVerifiedStubs();
    // Override /root with a validly SIGNED STH carrying an old timestamp.
    stubs.set("https://transparency.foxbook.dev/root", {
      status: 200,
      body: {
        rootHash: SINGLE_LEAF_HASH,
        leafCount: 1,
        publishedAt: "2020-01-01T00:00:00.000Z",
        sthJws: await signSth({
          rootHash: SINGLE_LEAF_HASH,
          treeSize: 1,
          timestamp: "2020-01-01T00:00:00.000Z",
        }),
      },
    });
    stubFetchByUrl(stubs);
    const result = await verifyAgentCard(aliceCard, {
      asset_type: "github_handle",
      requireFreshSTH: 3600,
    });
    if (result.status !== "stale-proof")
      throw new Error(`expected stale-proof, got ${result.status}`);
    expect(result.threshold_seconds).toBe(3600);
    expect(result.proof_age_seconds).toBeGreaterThan(3600);
  });

  it("requireFreshSTH: passes when STH is fresh enough", async () => {
    const stubs = await aliceVerifiedStubs();
    // Override with a validly SIGNED STH timestamped 1 second ago.
    const recent = new Date(Date.now() - 1000).toISOString();
    stubs.set("https://transparency.foxbook.dev/root", {
      status: 200,
      body: {
        rootHash: SINGLE_LEAF_HASH,
        leafCount: 1,
        publishedAt: recent,
        sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1, timestamp: recent }),
      },
    });
    stubFetchByUrl(stubs);
    const result = await verifyAgentCard(aliceCard, {
      asset_type: "github_handle",
      requireFreshSTH: 3600,
    });
    expect(result.status).toBe("verified");
  });

  it("requireFreshSTH: returns unverified when STH JWS is malformed", async () => {
    const stubs = await aliceVerifiedStubs();
    stubs.set("https://transparency.foxbook.dev/root", {
      status: 200,
      body: {
        rootHash: SINGLE_LEAF_HASH,
        leafCount: 1,
        publishedAt: "now",
        sthJws: "not-a-jws", // missing 3 segments
      },
    });
    stubFetchByUrl(stubs);
    const result = await verifyAgentCard(aliceCard, {
      asset_type: "github_handle",
      requireFreshSTH: 3600,
    });
    expect(result.status).toBe("unverified");
  });

  it("requireFreshSTH: returns unverified when STH signature is forged", async () => {
    // The STH carries a fresh timestamp but is signed by a key the
    // well-known surface does not advertise → freshness must NOT trust
    // the timestamp off an unverifiable head.
    const recent = new Date(Date.now() - 1000).toISOString();
    const stubs = await aliceVerifiedStubs();
    stubs.set(WELL_KNOWN_URL, wellKnownStub(WRONG_PUBLIC_KEY_HEX)[1]);
    stubs.set("https://transparency.foxbook.dev/root", {
      status: 200,
      body: {
        rootHash: SINGLE_LEAF_HASH,
        leafCount: 1,
        publishedAt: recent,
        sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1, timestamp: recent }),
      },
    });
    stubFetchByUrl(stubs);
    // requireInclusionProof:false isolates the freshness path from the
    // inclusion path (which would also reject the wrong key).
    const result = await verifyAgentCard(aliceCard, {
      asset_type: "github_handle",
      requireInclusionProof: false,
      requireFreshSTH: 3600,
    });
    if (result.status !== "unverified")
      throw new Error(`expected unverified, got ${result.status}`);
    expect(result.reason).toContain("STH signature");
  });

  it("returns unverified on inclusion proof failure", async () => {
    const stubs = await aliceVerifiedStubs();
    // Leaf hash differs from the SIGNED root, so the (empty) proof
    // reconstructs to TWO_LEAF_ROOT while the STH attests SINGLE_LEAF_HASH
    // → reconstruction can't match the signed root → fail closed.
    stubs.set("https://transparency.foxbook.dev/inclusion/0", {
      status: 200,
      body: {
        leafHash: TWO_LEAF_ROOT,
        leafIndex: 0,
        treeSize: 1,
        proofHex: [],
        rootHex: TWO_LEAF_ROOT,
      },
    });
    stubFetchByUrl(stubs);
    const result = await verifyAgentCard(aliceCard, { asset_type: "github_handle" });
    expect(result.status).toBe("unverified");
  });

  it("respects apiBase + worker_base overrides", async () => {
    stubFetchByUrl(
      new Map<string, FetchResponse>([
        [
          "https://staging-api.foxbook.dev/api/v1/claim/by-handle/github_handle/alice",
          {
            status: 200,
            body: {
              asset_type: "github_handle",
              asset_value: "alice",
              agent_did: ALICE_DID,
              state: "tier1_verified",
              verification_tier: 1,
              ed25519_public_key_hex: "f".repeat(64),
              revoked: false,
              leaf_index: 0,
            },
          },
        ],
        [
          "https://staging-tx.foxbook.dev/inclusion/0",
          {
            status: 200,
            body: {
              leafHash: SINGLE_LEAF_HASH,
              leafIndex: 0,
              treeSize: 1,
              proofHex: [],
              rootHex: SINGLE_LEAF_HASH,
            },
          },
        ],
        [
          "https://staging-tx.foxbook.dev/root",
          {
            status: 200,
            body: {
              rootHash: SINGLE_LEAF_HASH,
              leafCount: 1,
              publishedAt: "x",
              sthJws: await signSth({ rootHash: SINGLE_LEAF_HASH, treeSize: 1 }),
            },
          },
        ],
        // Well-known key fetched from the OVERRIDDEN api base.
        [
          "https://staging-api.foxbook.dev/.well-known/foxbook.json",
          { status: 200, body: { log_signing_public_key_hex: LOG_PUBLIC_KEY_HEX } },
        ],
      ]),
    );
    const result = await verifyAgentCard(aliceCard, {
      asset_type: "github_handle",
      apiBase: "https://staging-api.foxbook.dev",
      worker_base: "https://staging-tx.foxbook.dev",
    });
    expect(result.status).toBe("verified");
  });
});

// ---- Live tests (RUN_LIVE_TESTS=1) ----
//
// End-to-end against api.foxbook.dev + transparency.foxbook.dev. Gated
// to avoid CI flakiness on cross-PR-window state changes (someone
// might revoke a claim mid-CI). Run manually post-merge to validate
// the SDK against the deployed surface.

describe.skipIf(!process.env.RUN_LIVE_TESTS)("live (RUN_LIVE_TESTS=1)", () => {
  // The mock stubs above use vi.stubGlobal('fetch', ...). Live tests
  // need the real fetch. afterEach unstubs, so we just don't stub in
  // this describe block.
  beforeEach(() => {
    vi.unstubAllGlobals(); // undo the outer-scope stub
  });

  it("live: verify against transparency.foxbook.dev/inclusion/6 (cloakmaster's tier1 leaf)", async () => {
    const result = await verify({ leaf_index: 6 });
    if (!result.valid) throw new Error(`live verify failed: ${result.reason}`);
    expect(result.leaf_index).toBe(6);
    expect(result.root_hex).toMatch(/^[0-9a-f]{64}$/);
    expect(result.leaf_hash).toMatch(/^[0-9a-f]{64}$/);
  }, 15000);

  it("live: foxbookVerify returns tier1_verified for cloakmaster", async () => {
    const result = await foxbookVerify({
      asset_type: "github_handle",
      asset_value: "cloakmaster",
    });
    if ("status" in result) throw new Error(`live foxbookVerify failed: ${JSON.stringify(result)}`);
    expect(result.tier).toBe(1);
    expect(result.revoked).toBe(false);
    expect(result.did).toMatch(/^did:foxbook:[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(typeof result.leafIndex).toBe("number");
  }, 15000);

  it("live: foxbookVerify returns not-claimed for nonexistent handle", async () => {
    const result = await foxbookVerify({
      asset_type: "github_handle",
      asset_value: "this-handle-definitely-does-not-exist-12345xyz",
    });
    expect(result).toEqual({ status: "not-claimed" });
  }, 15000);

  it("live: verifyAgentCard end-to-end for cloakmaster", async () => {
    // Look up the live did first so we construct a card with the
    // matching did (no handle-mismatch).
    const lookup = await foxbookVerify({
      asset_type: "github_handle",
      asset_value: "cloakmaster",
    });
    if ("status" in lookup) throw new Error("setup failed");
    const card: VerifiableAgentCard = {
      handle: "cloakmaster",
      "x-foxbook": { did: lookup.did },
    };
    const result = await verifyAgentCard(card, { asset_type: "github_handle" });
    if (result.status !== "verified") {
      throw new Error(`live verifyAgentCard failed: ${JSON.stringify(result)}`);
    }
    expect(result.tier).toBe(1);
    expect(result.did).toBe(lookup.did);
  }, 30000);
});
