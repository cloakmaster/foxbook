// Unit tests for the firehose listener — fail-loud env validation,
// sentinel log lines on reconnect, exponential-backoff progression,
// payload decode + EventEmitter fanout.
//
// We inject a mock postgres-js factory to drive deterministic
// reconnect scenarios without touching a real Postgres. The mock
// surfaces the .listen() method + tagged-template SELECT shape that
// the real client exposes.

import { describe, expect, it, vi } from "vitest";

import { createFirehoseListener } from "../src/firehose/listener.js";
import { FIREHOSE_EVENT, type FirehoseRow } from "../src/firehose/types.js";

type MockSubscription = { unlisten: () => Promise<void> };
type MockListenHandler = (raw: string) => void;

type MockSqlBehaviour = {
  /** If set, .listen() rejects with this error on the Nth call (0-indexed). */
  listenFailsOnCall?: { call: number; error: Error };
  /** If set, the tagged template (SELECT 1) rejects on the Nth invocation. */
  selectFailsOnCall?: { call: number; error: Error };
};

function makeMockSqlClient(behaviour: MockSqlBehaviour = {}) {
  const listenCalls: Array<{ channel: string; handler: MockListenHandler }> = [];
  const selectCalls: number[] = [];
  let endCalls = 0;
  let listenInvocationCount = 0;
  let selectInvocationCount = 0;

  // The tagged-template function `sql\`SELECT 1\`` returns a thenable.
  const sql = (() => {
    const fn = Object.assign(
      // Tagged template signature.
      (..._args: unknown[]) => {
        const idx = selectInvocationCount++;
        selectCalls.push(idx);
        if (behaviour.selectFailsOnCall !== undefined && idx === behaviour.selectFailsOnCall.call) {
          return Promise.reject(behaviour.selectFailsOnCall.error);
        }
        return Promise.resolve([{ "?column?": 1 }]);
      },
      {
        listen: vi.fn(async (channel: string, handler: MockListenHandler) => {
          const idx = listenInvocationCount++;
          if (
            behaviour.listenFailsOnCall !== undefined &&
            idx === behaviour.listenFailsOnCall.call
          ) {
            throw behaviour.listenFailsOnCall.error;
          }
          listenCalls.push({ channel, handler });
          const sub: MockSubscription = {
            unlisten: vi.fn(async () => {}),
          };
          return sub;
        }),
        end: vi.fn(async () => {
          endCalls += 1;
        }),
      },
    );
    return fn;
  })();

  // Trigger a notification on the first registered handler. Tests use
  // this to simulate pg_notify firing.
  const notify = (rawPayload: string): void => {
    const last = listenCalls[listenCalls.length - 1];
    if (!last) throw new Error("notify(): no handler registered");
    last.handler(rawPayload);
  };

  return {
    sql,
    listenCalls,
    selectCalls,
    get endCalls() {
      return endCalls;
    },
    notify,
  };
}

const VALID_DIRECT_URL = "postgresql://user:pass@host.example/db";

describe("createFirehoseListener — env validation (fail-loud)", () => {
  it("throws if DATABASE_URL_DIRECT is empty + no override", () => {
    const original = process.env.DATABASE_URL_DIRECT;
    delete process.env.DATABASE_URL_DIRECT;
    try {
      expect(() =>
        createFirehoseListener({
          logger: () => {},
        }),
      ).toThrowError(/DATABASE_URL_DIRECT is not set/);
    } finally {
      if (original !== undefined) process.env.DATABASE_URL_DIRECT = original;
    }
  });

  it("throws if URL contains '-pooler' (pooled connection drops LISTEN)", () => {
    expect(() =>
      createFirehoseListener({
        url: "postgresql://user:pass@host-pooler.example/db",
        logger: () => {},
      }),
    ).toThrowError(/-pooler/);
  });
});

describe("createFirehoseListener — happy path", () => {
  it("subscribes, fans pg_notify payloads onto the emitter", async () => {
    const mock = makeMockSqlClient();
    const logs: string[] = [];
    const listener = createFirehoseListener({
      url: VALID_DIRECT_URL,
      clientFactory: (() => mock.sql) as never,
      logger: (line) => logs.push(line),
      heartbeatIntervalMs: 60_000, // long — we don't want heartbeat noise
    });

    const received: FirehoseRow[] = [];
    listener.emitter.on(FIREHOSE_EVENT, (row: FirehoseRow) => received.push(row));

    listener.start();

    // Wait for subscribe to complete (microtask drain).
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setImmediate(r));

    expect(logs.some((l) => l.startsWith("firehose_listener_subscribed"))).toBe(true);

    // Simulate Postgres firing the trigger.
    const samplePayload: FirehoseRow = {
      id: "00000000-0000-0000-0000-000000000001",
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
    mock.notify(JSON.stringify(samplePayload));

    expect(received).toHaveLength(1);
    expect(received[0]?.payload.event_type).toBe("claim.verified");

    await listener.stop();
  });

  it("ignores malformed payloads with a decode-error log line", async () => {
    const mock = makeMockSqlClient();
    const logs: string[] = [];
    const listener = createFirehoseListener({
      url: VALID_DIRECT_URL,
      clientFactory: (() => mock.sql) as never,
      logger: (line) => logs.push(line),
      heartbeatIntervalMs: 60_000,
    });

    const received: FirehoseRow[] = [];
    listener.emitter.on(FIREHOSE_EVENT, (row: FirehoseRow) => received.push(row));

    listener.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setImmediate(r));

    mock.notify("this is not json");

    expect(received).toHaveLength(0);
    expect(logs.some((l) => l.startsWith("firehose_listener_decode_error"))).toBe(true);

    await listener.stop();
  });
});

describe("createFirehoseListener — reconnect with sentinel log", () => {
  it("emits firehose_listener_reconnect with attempt + delay + reason on first failure", async () => {
    let invocation = 0;
    const mock1 = makeMockSqlClient({
      // First listen call rejects (simulate transient connect failure).
      listenFailsOnCall: { call: 0, error: new Error("ECONNREFUSED upstream") },
    });
    const mock2 = makeMockSqlClient(); // succeeds on the retry
    const factory = vi.fn(() => {
      const m = invocation === 0 ? mock1 : mock2;
      invocation += 1;
      return m.sql;
    });

    const logs: string[] = [];
    const listener = createFirehoseListener({
      url: VALID_DIRECT_URL,
      clientFactory: factory as never,
      logger: (line) => logs.push(line),
      reconnectDelaysMs: [10], // tight backoff for tests
      heartbeatIntervalMs: 60_000,
    });

    listener.start();

    // Wait long enough for the failure → reconnect → success path.
    await new Promise((r) => setTimeout(r, 80));

    const reconnectLogs = logs.filter((l) => l.startsWith("firehose_listener_reconnect"));
    expect(reconnectLogs.length).toBeGreaterThanOrEqual(1);
    const first = reconnectLogs[0]!;
    expect(first).toMatch(/attempt=1/);
    expect(first).toMatch(/delay=10ms/);
    expect(first).toMatch(/reason=.*ECONNREFUSED/);

    expect(logs.some((l) => l.startsWith("firehose_listener_subscribed"))).toBe(true);

    await listener.stop();
  });
});

describe("createFirehoseListener — self-test wedge defence (Day-8 obs)", () => {
  it("self-test ping fires after heartbeat tick and is filtered from public emitter when echoed", async () => {
    const mock = makeMockSqlClient();
    const logs: string[] = [];
    const listener = createFirehoseListener({
      url: VALID_DIRECT_URL,
      clientFactory: (() => mock.sql) as never,
      logger: (line) => logs.push(line),
      heartbeatIntervalMs: 30, // tight for test
      selfTestIntervalMs: 20, // fires on first heartbeat
      aliveLogEveryHeartbeats: 0, // disable alive log noise
    });

    const received: FirehoseRow[] = [];
    listener.emitter.on(FIREHOSE_EVENT, (row: FirehoseRow) => received.push(row));

    listener.start();

    // Wait for subscribe + first heartbeat + self-test ping fire.
    await new Promise((r) => setTimeout(r, 80));

    // The mock records every tagged-template call. Find a call whose
    // first interpolated arg is the channel (the second is the
    // payload string we serialized).
    const selfTestFireCount = mock.selectCalls.length;
    expect(selfTestFireCount).toBeGreaterThanOrEqual(1);

    // Simulate the echo arriving via pg_notify on the same channel.
    // The listener should recognize the self-test event_type and
    // filter it from the public emitter.
    // Find the most recently fired self-test payload by inspecting
    // listenCalls' bound handler: instead, we synthesize a payload
    // matching the self-test shape and inject via mock.notify.
    const echoPayload = JSON.stringify({
      id: "self-test-echo",
      report_id: "self-test",
      envelope_version: "1.0-draft",
      payload: {
        event_type: "__listener_self_test__",
        nonce: "test-nonce",
        fired_at: new Date().toISOString(),
      },
      published_at: new Date().toISOString(),
    });
    mock.notify(echoPayload);

    // Self-test events MUST NOT reach the public emitter.
    expect(received).toHaveLength(0);

    // Subsequent real events DO reach the public emitter.
    const realPayload = JSON.stringify({
      id: "real-event",
      report_id: "1",
      envelope_version: "1.0-draft",
      payload: {
        event_type: "claim.verified",
        did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
        leaf_index: 1,
        leaf_hash: "f".repeat(64),
        timestamp: new Date().toISOString(),
      },
      published_at: new Date().toISOString(),
    });
    mock.notify(realPayload);
    expect(received).toHaveLength(1);
    expect(received[0]?.payload.event_type).toBe("claim.verified");

    await listener.stop();
  });

  it("self-test wedge (ping fires but never echoes) triggers reconnect via sentinel log", async () => {
    let invocation = 0;
    const mock1 = makeMockSqlClient(); // first cycle: subscribes, fires self-test, no echo
    const mock2 = makeMockSqlClient(); // post-reconnect cycle
    const factory = vi.fn(() => {
      const m = invocation === 0 ? mock1 : mock2;
      invocation += 1;
      return m.sql;
    });

    const logs: string[] = [];
    const listener = createFirehoseListener({
      url: VALID_DIRECT_URL,
      clientFactory: factory as never,
      logger: (line) => logs.push(line),
      reconnectDelaysMs: [10],
      heartbeatIntervalMs: 30,
      selfTestIntervalMs: 20, // fires on first heartbeat
      aliveLogEveryHeartbeats: 0,
    });

    listener.start();

    // Wait long enough for: subscribe → first heartbeat → self-test fire →
    // tolerance window (selfTestIntervalMs * 1.5 = 30ms) elapses → next
    // heartbeat detects missing echo → throw → reconnect → resubscribe.
    await new Promise((r) => setTimeout(r, 250));

    expect(logs.some((l) => l.startsWith("firehose_listener_self_test_failed"))).toBe(true);
    expect(logs.some((l) => l.startsWith("firehose_listener_reconnect"))).toBe(true);
    // Resubscribe should have happened on the second factory invocation.
    expect(invocation).toBeGreaterThanOrEqual(2);

    await listener.stop();
  });

  it("aliveLogEveryHeartbeats=0 disables the periodic alive sentinel", async () => {
    const mock = makeMockSqlClient();
    const logs: string[] = [];
    const listener = createFirehoseListener({
      url: VALID_DIRECT_URL,
      clientFactory: (() => mock.sql) as never,
      logger: (line) => logs.push(line),
      heartbeatIntervalMs: 20,
      selfTestIntervalMs: 0, // also disable self-test for clean log surface
      aliveLogEveryHeartbeats: 0,
    });
    listener.start();
    await new Promise((r) => setTimeout(r, 100));
    expect(logs.some((l) => l.startsWith("firehose_listener_alive"))).toBe(false);
    await listener.stop();
  });
});
