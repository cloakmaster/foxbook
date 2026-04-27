// GET /firehose — Server-Sent Events stream.
//
// Subscribes a client to the in-process EventEmitter populated by the
// LISTEN/NOTIFY listener. Per SSE spec:
//   * Initial `retry: 5000` so browsers reconnect after 5s on drop.
//   * `data: <json>\n\n` per event.
//   * `: ping\n\n` heartbeat every 30s (comment line — no data,
//     prevents intermediaries from closing idle connections).
//
// Cleanup: on client disconnect (req.signal abort), we remove the
// emitter listener and clear the ping interval. This MUST happen even
// when the client closes mid-stream — leaking listeners would cap the
// service at maxListeners (we set Infinity on the emitter so this is a
// soft cap, but the FD/heap costs remain).
//
// ADR cross-refs:
//   * ADR 0005 — wire payload is `row_to_json(NEW)` from pg_notify
//     (display purpose); NOT used for hashing or signing downstream.

import type { EventEmitter } from "node:events";

import { Hono } from "hono";

import { FIREHOSE_EVENT, type FirehoseRow } from "./types.js";

/** Heartbeat interval — keep the SSE connection alive through proxies. */
const PING_INTERVAL_MS = 30_000;

/** Initial retry hint to the browser. 5s = sane default; aligns with the
 *  listener's faster reconnect tail. */
const SSE_INITIAL_RETRY_MS = 5_000;

export type FirehoseRouteDeps = {
  emitter: EventEmitter;
};

export function firehoseRoute(deps: FirehoseRouteDeps): Hono {
  const app = new Hono();

  app.get("/firehose", (c) => {
    const enc = new TextEncoder();
    const { emitter } = deps;

    // We capture these in the start() closure and clean them up on
    // cancel() / disconnect.
    let onEvent: ((row: FirehoseRow) => void) | null = null;
    let pingHandle: ReturnType<typeof setInterval> | null = null;
    let closed = false;

    const stream = new ReadableStream({
      start(controller) {
        const safeEnqueue = (chunk: Uint8Array) => {
          if (closed) return;
          try {
            controller.enqueue(chunk);
          } catch {
            // Stream already closed by the runtime.
            closed = true;
          }
        };

        // Initial framing: retry hint + sentinel comment so a curl
        // tail confirms the stream is open before the first event.
        safeEnqueue(enc.encode(`retry: ${SSE_INITIAL_RETRY_MS}\n`));
        safeEnqueue(enc.encode(`: foxbook firehose connected\n\n`));

        onEvent = (row: FirehoseRow) => {
          // JSON.stringify newlines: spec requires data lines without
          // raw \n. We serialize compact then split on the off-chance
          // a future event embeds a multiline string in payload.
          const json = JSON.stringify(row);
          // Split is defensive — a single \n in an SSE data line would
          // terminate the event prematurely. With JSON.stringify, raw
          // newlines are escaped as \\n, so this typically passes
          // through as one line; the split keeps us safe regardless.
          for (const line of json.split("\n")) {
            safeEnqueue(enc.encode(`data: ${line}\n`));
          }
          safeEnqueue(enc.encode("\n"));
        };
        emitter.on(FIREHOSE_EVENT, onEvent);

        pingHandle = setInterval(() => {
          safeEnqueue(enc.encode(`: ping\n\n`));
        }, PING_INTERVAL_MS);

        // Hono's c.req.raw.signal fires on client disconnect.
        const signal = c.req.raw.signal;
        const onAbort = () => {
          if (closed) return;
          closed = true;
          if (onEvent) emitter.off(FIREHOSE_EVENT, onEvent);
          onEvent = null;
          if (pingHandle) clearInterval(pingHandle);
          pingHandle = null;
          try {
            controller.close();
          } catch {
            // ignore
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });
      },
      cancel() {
        // Runtime asked us to stop producing. Mirror the abort path.
        closed = true;
        if (onEvent) emitter.off(FIREHOSE_EVENT, onEvent);
        onEvent = null;
        if (pingHandle) clearInterval(pingHandle);
        pingHandle = null;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  return app;
}
