// Postgres LISTEN/NOTIFY subscriber for the firehose.
//
// One persistent postgres-js connection over DATABASE_URL_DIRECT (NOT
// pooled — pooled connections drop LISTEN on PgBouncer recycling, which
// is a silent no-op on the wire). On any disconnect or subscribe
// failure, we reconnect with exponential backoff (1s → 2s → 4s → 8s →
// 16s → 30s capped) and log a sentinel line per attempt so dropped
// subscriptions are visible in operator dashboards instead of silently
// missed events.
//
// Sentinel log lines (grep-friendly, single-line, key=value):
//   firehose_listener_subscribed channel=foxbook_firehose attempt=N
//   firehose_listener_reconnect attempt=N elapsed=Ns delay=Mms reason=...
//   firehose_listener_decode_error reason=...
//
// Why a heartbeat loop after subscribing: postgres-js's `sql.listen()`
// resolves once subscribed and the library handles low-level reconnects
// internally; but a hard upstream drop (Neon side restart, network
// partition, connection-killed-by-DBA) can leave the listen state
// "subscribed" yet receiving zero notifications. We probe with `SELECT
// 1` every 30s; if it throws, we treat the connection as dead and
// drop into the reconnect-backoff loop. The cost is 1 round-trip every
// 30 seconds — negligible — and the win is "dropped subscription
// becomes visible within ~30s, not never."
//
// ADR cross-refs:
//   * ADR 0004 addendum-2 — caller-side firehose emission. The trigger
//     is the OUTBOUND fanout half; this listener is the SUBSCRIBER half.
//   * ADR 0005 — canonical bytes are written once, never re-derived.
//     The wire payload here is row_to_json output (display purpose);
//     NOT used for hashing or signing.

import { EventEmitter } from "node:events";

import { createDirectPostgresClient, type DirectPostgresClient } from "@foxbook/db";

import { FIREHOSE_EVENT, type FirehoseRow } from "./types.js";

/**
 * Reconnect backoff schedule (ms). Each entry is one attempt's pre-retry
 * sleep. After exhausting the list, every subsequent attempt sleeps for
 * the last value (30s capped).
 */
export const DEFAULT_RECONNECT_DELAYS_MS: readonly number[] = [
  1_000, 2_000, 4_000, 8_000, 16_000, 30_000,
];

/**
 * Default heartbeat interval. 30s — frequent enough to detect a dropped
 * subscription within an SLO-relevant window, infrequent enough to be a
 * negligible cost.
 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export type FirehoseListener = {
  /** Begin connect-subscribe-heartbeat loop. Idempotent: calling start a
   *  second time on a running listener is a no-op. Returns immediately;
   *  the loop runs in the background. */
  start: () => void;
  /** Drain the loop, unlisten, end the connection. Awaitable; returns
   *  when the listener has fully stopped. Idempotent. */
  stop: () => Promise<void>;
  /** In-process emitter. Listen for 'event' (FirehoseRow). */
  emitter: EventEmitter;
};

export type FirehoseListenerOptions = {
  /** Override DATABASE_URL_DIRECT. Defaults to env. */
  url?: string;
  /** LISTEN channel name. Default 'foxbook_firehose'. */
  channel?: string;
  /** Inject postgres-js factory for tests. */
  clientFactory?: (url?: string) => DirectPostgresClient;
  /** Logger. Defaults to console.log. Tests inject a recorder. */
  logger?: (line: string) => void;
  /** Backoff schedule override (tests). */
  reconnectDelaysMs?: readonly number[];
  /** Heartbeat interval override (tests). */
  heartbeatIntervalMs?: number;
};

/**
 * Build a listener. Throws synchronously at construction if
 * DATABASE_URL_DIRECT is missing or pooled — fail-loud is a binding
 * Day-7 contract (no silent fallback to DATABASE_URL).
 */
export function createFirehoseListener(opts: FirehoseListenerOptions = {}): FirehoseListener {
  const channel = opts.channel ?? "foxbook_firehose";
  const factory = opts.clientFactory ?? createDirectPostgresClient;
  const log = opts.logger ?? ((m) => console.log(m));
  const delays = opts.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS;
  const heartbeatMs = opts.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  // Validate URL shape eagerly so misconfiguration doesn't lurk until
  // first connect attempt. Pure string check — no factory invocation,
  // so injected mock factories see exactly the connect attempts we
  // make in the loop and nothing else.
  const explicitUrl = opts.url;
  if (explicitUrl === undefined) {
    const envUrl = process.env.DATABASE_URL_DIRECT;
    if (!envUrl) {
      throw new Error(
        "createFirehoseListener: DATABASE_URL_DIRECT is not set. " +
          "The listener requires a non-pooled Postgres URL — pooled connections drop LISTEN subscriptions on recycling. " +
          "NEVER fall back to DATABASE_URL.",
      );
    }
    if (envUrl.includes("-pooler")) {
      throw new Error(
        "createFirehoseListener: DATABASE_URL_DIRECT contains '-pooler' — must be non-pooled.",
      );
    }
  } else {
    if (explicitUrl === "") {
      throw new Error(
        "createFirehoseListener: empty url passed; provide a non-pooled DATABASE_URL_DIRECT.",
      );
    }
    if (explicitUrl.includes("-pooler")) {
      throw new Error("createFirehoseListener: url contains '-pooler' — must be non-pooled.");
    }
  }

  const emitter = new EventEmitter();
  emitter.setMaxListeners(0); // SSE clients can be many

  let stopped = false;
  let runLoop: Promise<void> | null = null;
  let activeClient: DirectPostgresClient | null = null;

  // Cancellable sleep — stop() wakes the current sleep so the loop
  // returns promptly instead of waiting up to heartbeatMs (default 30s).
  // Without this, a graceful shutdown blocks for the full sleep tail.
  let activeSleepCancel: (() => void) | null = null;
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      if (stopped) {
        resolve();
        return;
      }
      const handle = setTimeout(() => {
        activeSleepCancel = null;
        resolve();
      }, ms);
      activeSleepCancel = () => {
        clearTimeout(handle);
        activeSleepCancel = null;
        resolve();
      };
    });

  function pickDelay(attempt: number): number {
    const idx = Math.min(attempt - 1, delays.length - 1);
    return delays[idx] ?? 30_000;
  }

  async function loop(): Promise<void> {
    let attempt = 0;
    while (!stopped) {
      const cycleStart = Date.now();
      let sql: DirectPostgresClient | null = null;
      try {
        sql = opts.url !== undefined ? factory(opts.url) : factory();
        activeClient = sql;
        const subscription = await sql.listen(channel, (rawPayload: string) => {
          if (stopped) return;
          let parsed: FirehoseRow;
          try {
            parsed = JSON.parse(rawPayload) as FirehoseRow;
          } catch (e) {
            log(
              `firehose_listener_decode_error reason=${e instanceof Error ? e.message : String(e)}`,
            );
            return;
          }
          emitter.emit(FIREHOSE_EVENT, parsed);
        });

        log(`firehose_listener_subscribed channel=${channel} attempt=${attempt}`);
        attempt = 0;

        // Heartbeat loop: probe a SELECT 1 every heartbeatMs. If it
        // throws, the connection is dead and we drop into the
        // reconnect-backoff path. We DON'T probe immediately on
        // subscribe — listen() succeeded, so the connection is live
        // right now.
        // eslint-disable-next-line no-constant-condition
        while (!stopped) {
          await sleep(heartbeatMs);
          if (stopped) break;
          await sql`SELECT 1`;
        }

        // Stopped — clean shutdown.
        try {
          await subscription.unlisten();
        } catch {
          // ignore — connection may already be torn down
        }
        try {
          await sql.end({ timeout: 5 });
        } catch {
          // ignore
        }
        sql = null;
        activeClient = null;
        return;
      } catch (e) {
        attempt += 1;
        const delay = pickDelay(attempt);
        const elapsed = Math.round((Date.now() - cycleStart) / 1000);
        const reason = (e instanceof Error ? e.message : String(e)).replaceAll("\n", " ");
        log(
          `firehose_listener_reconnect attempt=${attempt} elapsed=${elapsed}s delay=${delay}ms reason=${reason}`,
        );
        if (sql) {
          try {
            await sql.end({ timeout: 5 });
          } catch {
            // ignore
          }
        }
        sql = null;
        activeClient = null;
        if (stopped) return;
        await sleep(delay);
      }
    }
  }

  return {
    emitter,
    start() {
      if (runLoop) return;
      runLoop = loop().catch((e) => {
        // The loop catches its own errors; this is a defense-in-depth
        // log for any uncaught surprise.
        log(`firehose_listener_loop_aborted reason=${e instanceof Error ? e.message : String(e)}`);
      });
    },
    async stop() {
      stopped = true;
      // Wake any active sleep so the loop checks `stopped` immediately
      // instead of waiting out the rest of the heartbeat interval.
      if (activeSleepCancel) {
        activeSleepCancel();
      }
      // Best-effort: kill the active connection so any in-flight
      // `SELECT 1` rejects promptly and the loop body falls through.
      if (activeClient) {
        try {
          await activeClient.end({ timeout: 0 });
        } catch {
          // ignore
        }
        activeClient = null;
      }
      if (runLoop) {
        await runLoop;
        runLoop = null;
      }
    },
  };
}
