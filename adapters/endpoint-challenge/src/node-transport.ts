// Node-native guarded transport for the endpoint-challenge adapter.
//
// The default fetch path can't rely on undici's `dispatcher`/`connect`
// hooks being reachable in every deploy, so we drive the request
// through node:https with a custom `lookup`. That lookup is the second
// SSRF layer: it runs at the exact moment the socket is about to dial
// an address and re-applies isBlockedIp to THAT address. Because the
// pre-flight resolution (guard.ts) and this connect-time resolution are
// both vetted, a DNS-rebinding flip between the two can't slip a
// private IP through — whichever address the socket actually dials is
// the one we classify.
//
// node:https never auto-follows redirects, so honouring
// `redirect: "manual"` is automatic here; index.ts inspects the 3xx
// itself. We translate the IncomingMessage into a web `Response` so the
// caller's code path (res.ok / res.json()) is identical to the injected
// fetch used in tests.

import dns from "node:dns";
import https from "node:https";
import type { LookupFunction } from "node:net";

import { isBlockedIp } from "./guard.js";

/**
 * Default host resolver for the SSRF pre-flight. Returns every address
 * node would consider for `hostname` (A + AAAA) so the pre-flight can
 * reject if ANY of them is private — not just the first one tried.
 */
export async function nodeResolveHostname(hostname: string): Promise<string[]> {
  const records = await dns.promises.lookup(hostname, { all: true });
  return records.map((r) => r.address);
}

/** The node:dns.lookup shape we depend on — injectable so the guard's
 *  block-on-resolve behaviour is testable without real DNS. */
type RawLookup = typeof dns.lookup;

/**
 * Build a `lookup` that refuses to hand a blocked address back to the
 * socket layer. This is the connect-time pin: the address returned here
 * is the one the TCP/TLS connection uses, so classifying it closes the
 * rebind window left open by the earlier pre-flight resolution. The
 * underlying resolver is injected so tests can exercise the block path
 * deterministically.
 */
export function makeGuardedLookup(rawLookup: RawLookup): LookupFunction {
  return ((hostname: string, options: unknown, callback?: unknown): void => {
    // Normalise the overloaded (hostname, callback) / (hostname, options,
    // callback) signatures node uses internally. `cb` is loosely typed
    // because node calls back with either a single (address, family) or —
    // when `all:true` — an array of {address, family}; we handle both.
    const cb = (typeof options === "function" ? options : callback) as (
      err: NodeJS.ErrnoException | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number,
    ) => void;
    const opts = (typeof options === "function" ? {} : options) as dns.LookupOptions;

    const blockedError = (address: string): NodeJS.ErrnoException => {
      const e = new Error(
        `blocked SSRF target: ${hostname} resolved to disallowed address ${address}`,
      ) as NodeJS.ErrnoException;
      e.code = "EAI_BLOCKED";
      return e;
    };

    rawLookup(
      hostname,
      opts,
      (err: NodeJS.ErrnoException | null, address: unknown, family?: number) => {
        if (err) {
          cb(err, "", 0);
          return;
        }
        // `all:true` → address is an array of every candidate; reject if
        // ANY is blocked (node would otherwise dial any of them).
        if (Array.isArray(address)) {
          for (const entry of address as Array<{ address: string; family: number }>) {
            if (isBlockedIp(entry.address)) {
              cb(blockedError(entry.address), "", 0);
              return;
            }
          }
          cb(null, address as Array<{ address: string; family: number }>);
          return;
        }
        // Single-address form: classify the exact address node will dial.
        const addr = address as string;
        if (isBlockedIp(addr)) {
          cb(blockedError(addr), "", 0);
          return;
        }
        cb(null, addr, family);
      },
    );
  }) as LookupFunction;
}

/** Production guarded lookup, backed by the real node:dns resolver. */
const guardedLookup: LookupFunction = makeGuardedLookup(dns.lookup);

/**
 * Minimal fetch over node:https with the guarded lookup wired in. Only
 * the subset of the fetch contract the adapter uses is implemented:
 * method, headers, string body, the abort signal, and a `Response`
 * exposing `status`, `ok`, `headers.get`, and `json()`.
 */
export const nodeSafeFetch: typeof globalThis.fetch = ((
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? init.body : undefined;
  const signal = init?.signal ?? undefined;

  const headers: Record<string, string> = {};
  if (init?.headers) {
    const h = new Headers(init.headers);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }

  return new Promise<Response>((resolve, reject) => {
    if (signal?.aborted) {
      reject(makeAbortError());
      return;
    }

    const req = https.request(url, { method, headers, lookup: guardedLookup }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        const responseHeaders = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue;
          responseHeaders.set(k, Array.isArray(v) ? v.join(", ") : v);
        }
        // node:https leaves redirect bodies intact and never follows;
        // build a Response that mirrors fetch's redirect:"manual".
        resolve(
          new Response(buf, {
            status: res.statusCode ?? 502,
            headers: responseHeaders,
          }),
        );
      });
      res.on("error", reject);
    });

    req.on("error", reject);

    const onAbort = () => {
      req.destroy(makeAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    req.on("close", () => signal?.removeEventListener("abort", onAbort));

    if (body !== undefined) req.write(body);
    req.end();
  });
}) as typeof globalThis.fetch;

/** AbortError shaped like the one fetch raises, so the adapter's
 *  `e.name === "AbortError"` timeout branch fires identically. */
function makeAbortError(): Error {
  const e = new Error("The operation was aborted");
  e.name = "AbortError";
  return e;
}
