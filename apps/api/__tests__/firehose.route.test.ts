// SSE route tests — initial framing (retry hint + comment), event
// fan-out from the in-process emitter, and clean shutdown via the
// abort signal.

import { EventEmitter } from "node:events";

import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { firehoseRoute } from "../src/firehose/route.js";
import { FIREHOSE_EVENT, type FirehoseRow } from "../src/firehose/types.js";

function makeApp(emitter: EventEmitter) {
  const app = new Hono();
  app.route("/", firehoseRoute({ emitter }));
  return app;
}

const SAMPLE_ROW: FirehoseRow = {
  id: "00000000-0000-0000-0000-00000000abcd",
  report_id: "1",
  envelope_version: "1.0-draft",
  payload: {
    event_type: "claim.verified",
    did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
    leaf_index: 1,
    leaf_hash: "f".repeat(64),
    timestamp: "2026-04-27T08:00:00.000Z",
  },
  published_at: "2026-04-27T08:00:00.000Z",
};

async function readChunks(res: Response, atLeastBytes: number, timeoutMs = 1000): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("response has no body");
  const decoder = new TextDecoder();
  let buf = "";
  const start = Date.now();
  while (buf.length < atLeastBytes && Date.now() - start < timeoutMs) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) buf += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  return buf;
}

describe("GET /firehose — SSE", () => {
  it("returns text/event-stream with no-cache headers", async () => {
    const emitter = new EventEmitter();
    const app = makeApp(emitter);
    const ctrl = new AbortController();
    const res = await app.request("/firehose", { signal: ctrl.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toMatch(/no-cache/);
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    ctrl.abort();
  });

  it("emits initial retry hint + connected comment before any event", async () => {
    const emitter = new EventEmitter();
    const app = makeApp(emitter);
    const ctrl = new AbortController();
    const res = await app.request("/firehose", { signal: ctrl.signal });
    const text = await readChunks(res, 30, 500);
    expect(text).toContain("retry: 5000");
    expect(text).toContain(": foxbook firehose connected");
    ctrl.abort();
  });

  it("fans an emitted FirehoseRow as a single SSE data frame", async () => {
    const emitter = new EventEmitter();
    const app = makeApp(emitter);
    const ctrl = new AbortController();
    const res = await app.request("/firehose", { signal: ctrl.signal });
    // Give the start() callback a chance to register the listener.
    await new Promise((r) => setImmediate(r));
    emitter.emit(FIREHOSE_EVENT, SAMPLE_ROW);
    const text = await readChunks(res, 100, 500);
    // Data line is present with the full JSON serialization (proves
    // emitter → SSE wire fanout). The terminating \n\n may arrive in
    // a separate chunk; the toContain check is the load-bearing
    // assertion here.
    expect(text).toContain(`data: ${JSON.stringify(SAMPLE_ROW)}`);
    expect(text).toMatch(/data: \{.*\}\n/);
    ctrl.abort();
  });

  it("removes the emitter listener on stream cancel (no leak)", async () => {
    const emitter = new EventEmitter();
    const app = makeApp(emitter);
    const ctrl = new AbortController();
    const res = await app.request("/firehose", { signal: ctrl.signal });
    await new Promise((r) => setImmediate(r));
    expect(emitter.listenerCount(FIREHOSE_EVENT)).toBe(1);

    // Cancel via abort signal.
    ctrl.abort();
    // Drain the body so the runtime tears down the stream.
    try {
      await res.body?.cancel();
    } catch {
      // ignore
    }
    // Listener count drops to 0 either via abort handler or cancel().
    // Allow a couple of microtasks for cleanup to land.
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(emitter.listenerCount(FIREHOSE_EVENT)).toBe(0);
  });
});
