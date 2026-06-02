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
//   firehose_listener_self_test_failed observed_lag=Ns expected=Ms
//   firehose_listener_alive heartbeats=N events=M self_tests_ok=K
//
// Why a heartbeat loop after subscribing: postgres-js's `sql.listen()`
// resolves once subscribed and the library handles low-level reconnects
// internally; but a hard upstream drop (Neon side restart, network
// partition, connection-killed-by-DBA) can leave the listen state
// "subscribed" yet receiving zero notifications. We probe with `SELECT
// 1` every 30s; if it throws, we treat the connection as dead and
// drop into the reconnect-backoff loop.
//
// Why a self-test layer (Day-8 addition): on Day-7 we observed a
// failure mode where the listener received exactly ONE notification
// with a malformed (non-JSON) payload, the decode_error logged, and
// every subsequent NOTIFY (valid or not) was silently dropped despite
// the underlying TCP connection staying alive (verified via
// pg_stat_activity — connection idle, application_name still
// `foxbook-firehose-listener`, but the LISTEN dispatch was wedged at
// the postgres-js library layer). Hypothesis: postgres-js's
// notification dispatch state corrupted by a synchronous JSON parse
// failure inside the user callback, even though the callback returned
// normally. Production triggers always emit valid `row_to_json` JSON,
// so this isn't a runtime risk — but a future migration or future
// event type that emits something the listener can't parse would
// silently kill the firehose with no automatic recovery.
//
// The self-test layer defends against that wedge: if `selfTestIntervalMs`
// is set, the listener periodically fires its own `pg_notify` (via the
// heartbeat-pool connection, not the LISTEN connection) carrying a
// `__listener_self_test__` event_type. If the listener's own dispatch
// is healthy, the round-trip arrives within milliseconds and the
// internal echo timestamp updates; if the dispatch is wedged, the
// echo never arrives and the next heartbeat tick force-reconnects
// the listener with a `firehose_listener_self_test_failed` sentinel.
// Self-test events are filtered out before reaching the public
// EventEmitter so SSE clients don't see them.
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

/**
 * Internal event_type for the listener's own self-test pings. Filtered
 * out before reaching the public EventEmitter — SSE clients never see
 * these.
 */
export const LISTENER_SELF_TEST_EVENT_TYPE = "__listener_self_test__" as const;

/**
 * Default self-test interval. 60s — run once per two heartbeats, so the
 * dispatch-wedge detection window is bounded at ~60–90s. Set to 0 to
 * disable self-test (heartbeat-only mode, as on Day-7).
 */
export const DEFAULT_SELF_TEST_INTERVAL_MS = 60_000;

/**
 * Tolerance for self-test echo arrival. If a self-test ping doesn't
 * echo within `selfTestIntervalMs * SELF_TEST_LAG_TOLERANCE`, we treat
 * the listener as wedged and force-reconnect.
 */
const SELF_TEST_LAG_TOLERANCE = 1.5;

/**
 * Heartbeat-counter cadence for the periodic alive log. Every N
 * heartbeats, the listener emits a sentinel summarizing how many
 * events + self-tests have arrived. 10 = once every ~5 minutes at
 * default heartbeat. Set to 0 to disable the periodic alive log.
 */
export const DEFAULT_ALIVE_LOG_EVERY_HEARTBEATS = 10;

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
  /** Self-test interval (Day-8 wedge defence). 0 disables. Default 60s. */
  selfTestIntervalMs?: number;
  /** How many heartbeats between periodic 'alive' summary logs. 0 disables. Default 10. */
  aliveLogEveryHeartbeats?: number;
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
  const selfTestMs = opts.selfTestIntervalMs ?? DEFAULT_SELF_TEST_INTERVAL_MS;
  const aliveLogEvery = opts.aliveLogEveryHeartbeats ?? DEFAULT_ALIVE_LOG_EVERY_HEARTBEATS;

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

      // Per-cycle counters reset on each (re)subscribe. Visible via the
      // periodic firehose_listener_alive sentinel.
      let heartbeatCount = 0;
      let eventCount = 0;
      let selfTestOkCount = 0;

      // Self-test echo state. lastSelfTestNonce is the most recent
      // ping we fired; lastSelfTestEchoNonce is the most recent ping
      // we received back via our own onnotify handler. Equality means
      // dispatch is healthy. Inequality after a tolerance window means
      // wedge → reconnect.
      let lastSelfTestNonce: string | null = null;
      let lastSelfTestFiredAt = 0;
      let lastSelfTestEchoNonce: string | null = null;

      try {
        sql = opts.url !== undefined ? factory(opts.url) : factory();
        activeClient = sql;
        const subscription = await sql.listen(channel, (rawPayload: string) => {
          if (stopped) return;
          let parsed: FirehoseRow;
          try {
            parsed = JSON.parse(rawPayload) as FirehoseRow;
          } catch (e) {
            // Defensive: even on decode failure, the listener received
            // bytes, so the dispatch is healthy. We don't update
            // event-counter (no public event delivered) but the parse
            // failure itself is sentinel-logged so operators see it.
            log(
              `firehose_listener_decode_error reason=${e instanceof Error ? e.message : String(e)}`,
            );
            return;
          }
          // Filter out self-test pings before reaching the public emitter.
          // event_type is widened to string here because the self-test
          // value is INTERNAL — never registered in schemas/envelope/v1.json
          // (the public enum), so it's correctly absent from the
          // FirehoseEventType union. Cast surfaces the wire reality
          // (server-side row JSON can carry any string).
          const eventType = parsed.payload?.event_type as string | undefined;
          if (eventType === LISTENER_SELF_TEST_EVENT_TYPE) {
            const nonce = (parsed.payload as { nonce?: string }).nonce;
            if (typeof nonce === "string") {
              lastSelfTestEchoNonce = nonce;
              selfTestOkCount += 1;
            }
            return;
          }
          eventCount += 1;
          emitter.emit(FIREHOSE_EVENT, parsed);
        });

        log(`firehose_listener_subscribed channel=${channel} attempt=${attempt}`);
        attempt = 0;

        // Heartbeat loop: probe a SELECT 1 every heartbeatMs. If it
        // throws, the connection is dead and we drop into the
        // reconnect-backoff path. Optionally fire a self-test ping
        // and verify the prior ping echoed.
        while (!stopped) {
          await sleep(heartbeatMs);
          if (stopped) break;
          await sql`SELECT 1`;
          heartbeatCount += 1;

          // Self-test wedge defence (Day-8). If the prior ping was
          // fired but never echoed within tolerance, the LISTEN
          // dispatch is wedged — force-reconnect. If selfTestMs is 0,
          // skip entirely.
          if (selfTestMs > 0) {
            // Verify prior ping echoed.
            if (
              lastSelfTestNonce !== null &&
              lastSelfTestEchoNonce !== lastSelfTestNonce &&
              Date.now() - lastSelfTestFiredAt > selfTestMs * SELF_TEST_LAG_TOLERANCE
            ) {
              const lag = Date.now() - lastSelfTestFiredAt;
              log(
                `firehose_listener_self_test_failed observed_lag=${lag}ms expected_within=${Math.round(selfTestMs * SELF_TEST_LAG_TOLERANCE)}ms — forcing reconnect`,
              );
              throw new Error(`self-test echo lag ${lag}ms exceeded tolerance`);
            }
            // Fire next ping if interval elapsed.
            if (Date.now() - lastSelfTestFiredAt >= selfTestMs) {
              const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              const payload = JSON.stringify({
                event_type: LISTENER_SELF_TEST_EVENT_TYPE,
                nonce,
                fired_at: new Date().toISOString(),
              });
              try {
                await sql`SELECT pg_notify(${channel}, ${payload})`;
                lastSelfTestNonce = nonce;
                lastSelfTestFiredAt = Date.now();
              } catch (e) {
                // If we can't even fire pg_notify, the connection is
                // hosed in a way SELECT 1 didn't catch — let the next
                // SELECT 1 throw or wait one more cycle.
                log(
                  `firehose_listener_self_test_fire_failed reason=${e instanceof Error ? e.message : String(e)}`,
                );
              }
            }
          }

          // Periodic alive sentinel. Useful for "the listener is
          // healthy and these are the counts so far" observability
          // without log-flood.
          if (aliveLogEvery > 0 && heartbeatCount % aliveLogEvery === 0) {
            log(
              `firehose_listener_alive heartbeats=${heartbeatCount} events=${eventCount} self_tests_ok=${selfTestOkCount}`,
            );
          }
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
