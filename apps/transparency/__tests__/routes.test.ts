import type {
  MerkleConsistencyProof,
  MerkleInclusionProof,
  MerkleRepository,
  MerkleRootSnapshot,
} from "@foxbook/db";
import { describe, expect, it } from "vitest";

import { createApp, type TransparencyEnv } from "../src/server.js";

const ENV: TransparencyEnv = { DATABASE_URL: "unused-in-tests" };

type FakeState = {
  root: MerkleRootSnapshot | null;
  leaves: Array<{ leafIndex: number; leafHash: string; leafData: unknown; appendedAt: Date }>;
  inclusion: Map<number, MerkleInclusionProof>;
  consistency: Map<string, MerkleConsistencyProof>;
};

function fakeRepo(state: FakeState): MerkleRepository {
  return {
    append: () => {
      throw new Error("append must never be called from the transparency Worker");
    },
    getRoot: async () => state.root,
    getLeaf: async (index) => state.leaves.find((l) => l.leafIndex === index) ?? null,
    getInclusionProof: async (index) => {
      const p = state.inclusion.get(index);
      if (!p) throw new Error(`no inclusion proof for index ${index}`);
      return p;
    },
    getConsistencyProof: async (oldSize, newSize) => {
      const p = state.consistency.get(`${oldSize}->${newSize}`);
      if (!p) throw new Error(`no consistency proof for ${oldSize}->${newSize}`);
      return p;
    },
  };
}

function emptyState(): FakeState {
  return { root: null, leaves: [], inclusion: new Map(), consistency: new Map() };
}

function populatedState(): FakeState {
  const root: MerkleRootSnapshot = {
    rootHash: `sha256:${"a".repeat(64)}`,
    leafCount: 3,
    publishedAt: new Date("2026-04-23T10:00:00Z"),
    sthJws: "eyJhbGciOiJFZERTQSJ9.eyJ9.x",
  };
  return {
    root,
    leaves: [
      {
        leafIndex: 0,
        leafHash: "f".repeat(64),
        leafData: { leaf_type: "agent-key-registration" },
        appendedAt: new Date("2026-04-23T09:00:00Z"),
      },
      {
        leafIndex: 1,
        leafHash: "e".repeat(64),
        leafData: { leaf_type: "agent-key-registration" },
        appendedAt: new Date("2026-04-23T09:30:00Z"),
      },
      {
        leafIndex: 2,
        leafHash: "d".repeat(64),
        leafData: { leaf_type: "agent-key-registration" },
        appendedAt: new Date("2026-04-23T10:00:00Z"),
      },
    ],
    inclusion: new Map([
      [
        0,
        {
          leafHash: "f".repeat(64),
          leafIndex: 0,
          treeSize: 3,
          proofHex: ["b".repeat(64), "c".repeat(64)],
          rootHex: "a".repeat(64),
        },
      ],
    ]),
    consistency: new Map([
      [
        "1->3",
        {
          oldSize: 1,
          newSize: 3,
          proofHex: ["b".repeat(64), "c".repeat(64)],
        },
      ],
    ]),
  };
}

describe("transparency Worker — /health", () => {
  it("returns 200 with service identifier", async () => {
    const app = createApp(() => fakeRepo(emptyState()));
    const res = await app.request("/health", {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("foxbook-transparency");
  });
});

describe("transparency Worker — /root", () => {
  it("returns 404 on empty log", async () => {
    const app = createApp(() => fakeRepo(emptyState()));
    const res = await app.request("/root", {}, ENV);
    expect(res.status).toBe(404);
  });

  it("returns the latest STH on a populated log", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/root", {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as MerkleRootSnapshot;
    expect(body.leafCount).toBe(3);
    expect(body.rootHash).toBe(`sha256:${"a".repeat(64)}`);
  });

  it("sets Cache-Control: no-store on /root", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/root", {}, ENV);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("transparency Worker — /leaf/:index", () => {
  it("returns 400 on non-integer index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/leaf/abc", {}, ENV);
    expect(res.status).toBe(400);
  });

  it("returns 400 on negative index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/leaf/-1", {}, ENV);
    expect(res.status).toBe(400);
  });

  it("returns 404 for out-of-range index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/leaf/99", {}, ENV);
    expect(res.status).toBe(404);
  });

  it("returns the leaf row at a valid index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/leaf/1", {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { leafIndex: number; leafHash: string };
    expect(body.leafIndex).toBe(1);
    expect(body.leafHash).toBe("e".repeat(64));
  });

  it("sets Cache-Control: immutable on /leaf/:index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/leaf/1", {}, ENV);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });
});

describe("transparency Worker — /inclusion/:index", () => {
  it("returns 400 on invalid index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/inclusion/not-a-number", {}, ENV);
    expect(res.status).toBe(400);
  });

  it("returns the proof at a valid index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/inclusion/0", {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as MerkleInclusionProof;
    expect(body.leafIndex).toBe(0);
    expect(body.proofHex).toHaveLength(2);
  });

  it("sets immutable Cache-Control on /inclusion/:index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/inclusion/0", {}, ENV);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("returns 400 with the repo's error on unknown index", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/inclusion/99", {}, ENV);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/no inclusion proof/);
  });
});

describe("transparency Worker — /consistency", () => {
  it("returns 400 if old/new missing", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/consistency", {}, ENV);
    expect(res.status).toBe(400);
  });

  it("returns 400 if old > new", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/consistency?old=5&new=3", {}, ENV);
    expect(res.status).toBe(400);
  });

  it("returns the proof for a valid (old, new) pair", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/consistency?old=1&new=3", {}, ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as MerkleConsistencyProof;
    expect(body.oldSize).toBe(1);
    expect(body.newSize).toBe(3);
    expect(body.proofHex).toHaveLength(2);
  });

  it("sets immutable Cache-Control on /consistency", async () => {
    const app = createApp(() => fakeRepo(populatedState()));
    const res = await app.request("/consistency?old=1&new=3", {}, ENV);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });
});

describe("transparency Worker — /schemas/*", () => {
  const paths = [
    "/schemas/envelope/v1.json",
    "/schemas/agent-card/v1.json",
    "/schemas/x-foxbook/v1.json",
    "/schemas/tl-leaf/v1.json",
    "/schemas/merkle-test-vectors.json",
  ];

  for (const path of paths) {
    it(`serves ${path} with JSON body + short cache`, async () => {
      const app = createApp(() => fakeRepo(emptyState()));
      const res = await app.request(path, {}, ENV);
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
      const body = (await res.json()) as { $schema?: string; $id?: string };
      // Every schema has either $schema (JSON Schema draft URI) or $id
      // — the merkle-test-vectors.json has $comment instead, so we
      // only require the response parses as JSON.
      expect(typeof body).toBe("object");
    });
  }

  it("404 for unknown schema path", async () => {
    const app = createApp(() => fakeRepo(emptyState()));
    const res = await app.request("/schemas/does-not-exist.json", {}, ENV);
    expect(res.status).toBe(404);
  });
});

describe("transparency Worker — never calls append", () => {
  it("the fake repo's append throws (regression guard)", () => {
    const repo = fakeRepo(populatedState());
    expect(() => repo.append({ any: "thing" })).toThrow(/append must never/);
  });
});
