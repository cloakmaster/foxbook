// transparency.foxbook.dev — Hono app. Read-only Merkle log surface.
//
// Pattern mirrors apps/api: createApp takes injected deps (here, a
// factory that builds a MerkleRepository from Worker `env`) so tests
// drive the exact same app object against an in-memory fake. Worker
// runtime specifics (the `fetch` handler signature + env binding
// lookup) live in main.ts; this file stays runtime-agnostic.
//
// Every response explicitly sets Cache-Control:
//   - /root ....................... no-store   (STH updates per append)
//   - /leaf/:index ................ immutable  (leaf at index N never changes)
//   - /inclusion/:index ........... immutable  (proof for index N ...)
//   - /consistency?old&new ........ immutable  (proof for fixed (m,n) ...)
//   - /schemas/* .................. max-age=300 (schemas can change additively
//                                                within v1.x per LOCKED.md)
// No additional /schemas subpath is set immutable because additive
// schema additions happen behind the same URL.

import type { MerkleRepository } from "@foxbook/db";
import { Hono } from "hono";

import agentCardSchema from "../../../schemas/agent-card.v1.json" with { type: "json" };
import envelopeSchema from "../../../schemas/envelope/v1.json" with { type: "json" };
import merkleVectorsSchema from "../../../schemas/merkle-test-vectors.json" with { type: "json" };
import tlLeafSchema from "../../../schemas/tl-leaf.v1.json" with { type: "json" };
import xFoxbookSchema from "../../../schemas/x-foxbook.v1.json" with { type: "json" };

export type TransparencyEnv = {
  DATABASE_URL: string;
};

export type Bindings = { Bindings: TransparencyEnv };
export type RepoFactory = (env: TransparencyEnv) => MerkleRepository;

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const SCHEMA_CACHE = "public, max-age=300";
const LANDING_CACHE = "public, max-age=3600";
const NO_STORE = "no-store";

const LANDING_HTML = `<!doctype html>
<meta charset="utf-8">
<title>Foxbook Transparency Log</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#222}
h1,h2{font-family:ui-monospace,Menlo,Monaco,Consolas,monospace}
h1{font-size:1.4rem}h2{font-size:1.05rem;margin-top:2rem}
code,pre{font-family:ui-monospace,Menlo,Monaco,Consolas,monospace;background:#f4f4f4;padding:.1em .3em;border-radius:3px}
pre{padding:.75rem;overflow-x:auto}
ul{padding-left:1.25rem}li{margin:.35rem 0}a{color:#0366d6}
</style>
<h1>🦊 Foxbook Transparency Log</h1>
<p>RFC-9162-shaped Merkle log for verifiable agent identity (A2A / MCP).</p>
<h2>Endpoints</h2>
<ul>
<li><code><a href="/root">/root</a></code> — signed tree head (latest)</li>
<li><code>/leaf/:index</code> — leaf at index <code>:index</code></li>
<li><code>/inclusion/:index</code> — inclusion proof for <code>:index</code></li>
<li><code>/consistency?old=N&amp;new=M</code> — consistency proof between sizes N and M</li>
</ul>
<h2>Try it</h2>
<pre>curl -s https://transparency.foxbook.dev/root | jq</pre>
<h2>Docs</h2>
<ul>
<li><a href="https://github.com/cloakmaster/foxbook">Repo</a></li>
<li><a href="https://github.com/cloakmaster/foxbook/blob/main/docs/rfc-a2a-x-foxbook-extension.md">RFC: x-foxbook v1 for A2A AgentCard</a></li>
<li><a href="https://github.com/a2aproject/A2A/discussions/1803">A2A Discussion #1803</a></li>
</ul>
`;

const SCHEMAS: Record<string, unknown> = {
  "/envelope/v1.json": envelopeSchema,
  "/agent-card/v1.json": agentCardSchema,
  "/x-foxbook/v1.json": xFoxbookSchema,
  "/tl-leaf/v1.json": tlLeafSchema,
  "/merkle-test-vectors.json": merkleVectorsSchema,
};

export function createApp(repoFactory: RepoFactory): Hono<Bindings> {
  const app = new Hono<Bindings>();

  app.get("/", (c) => {
    c.header("Cache-Control", LANDING_CACHE);
    return c.html(LANDING_HTML);
  });

  app.get("/health", (c) => c.json({ ok: true, service: "foxbook-transparency" }));

  app.get("/root", async (c) => {
    c.header("Cache-Control", NO_STORE);
    const root = await repoFactory(c.env).getRoot();
    if (root === null) {
      return c.json({ error: "log is empty" }, 404);
    }
    return c.json(root);
  });

  app.get("/leaf/:index", async (c) => {
    const idx = Number(c.req.param("index"));
    if (!Number.isInteger(idx) || idx < 0) {
      return c.json({ error: "index must be a non-negative integer" }, 400);
    }
    c.header("Cache-Control", IMMUTABLE_CACHE);
    const leaf = await repoFactory(c.env).getLeaf(idx);
    if (leaf === null) {
      return c.json({ error: `no leaf at index ${idx}` }, 404);
    }
    return c.json(leaf);
  });

  app.get("/inclusion/:index", async (c) => {
    const idx = Number(c.req.param("index"));
    if (!Number.isInteger(idx) || idx < 0) {
      return c.json({ error: "index must be a non-negative integer" }, 400);
    }
    c.header("Cache-Control", IMMUTABLE_CACHE);
    try {
      const proof = await repoFactory(c.env).getInclusionProof(idx);
      return c.json(proof);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  app.get("/consistency", async (c) => {
    const oldSize = Number(c.req.query("old"));
    const newSize = Number(c.req.query("new"));
    if (
      !Number.isInteger(oldSize) ||
      !Number.isInteger(newSize) ||
      oldSize < 0 ||
      newSize < 0 ||
      oldSize > newSize
    ) {
      return c.json({ error: "old/new must be non-negative integers with old <= new" }, 400);
    }
    c.header("Cache-Control", IMMUTABLE_CACHE);
    try {
      const proof = await repoFactory(c.env).getConsistencyProof(oldSize, newSize);
      return c.json(proof);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });

  for (const [path, schema] of Object.entries(SCHEMAS)) {
    app.get(`/schemas${path}`, (c) => {
      c.header("Cache-Control", SCHEMA_CACHE);
      return c.json(schema);
    });
  }

  return app;
}
