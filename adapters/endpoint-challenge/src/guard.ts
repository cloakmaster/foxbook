// SSRF guard for the endpoint-challenge adapter.
//
// The adapter POSTs to a URL the *claimant* supplies (endpoint_url over
// two unauthenticated requests). Without vetting, that URL is a server-
// side request forgery primitive: a claimant could point it at cloud
// metadata (169.254.169.254), at loopback (127.0.0.1 / ::1), or at
// RFC-1918 / ULA internal services and read the JSON we round-trip.
//
// Defence is two-layer:
//   1. Pre-flight (assertOutboundAllowed): https-only, then resolve the
//      hostname and reject if ANY candidate IP is in a blocked range.
//      This runs BEFORE any socket is opened.
//   2. Connect-time pin (see nodeGuardedFetch in index.ts): the actual
//      socket lookup re-runs isBlockedIp on the address it is about to
//      dial, which closes the DNS-rebinding window between pre-flight
//      resolution and the real connection.
//
// Both layers share isBlockedIp so the policy lives in exactly one
// place. The classifier works on the canonical string form node's
// dns.lookup / net.isIP produce.

import { isIP } from "node:net";

export type OutboundReason = "blocked_scheme" | "blocked_host";

export type OutboundDecision =
  | { ok: true; host: string; pinnedIps: string[] }
  | { ok: false; reason: OutboundReason; detail: string };

/** Resolve a hostname to its candidate IP strings. Injected so tests
 *  can drive deterministic DNS without touching the network; the
 *  production default in index.ts wraps node:dns. */
export type HostResolver = (hostname: string) => Promise<string[]>;

/** Parse an IPv4 dotted-quad into its four octets, or null if it isn't
 *  a syntactically valid v4 literal. */
function parseV4(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (part.length === 0 || part.length > 3 || !/^[0-9]+$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    octets.push(n);
  }
  return [octets[0] as number, octets[1] as number, octets[2] as number, octets[3] as number];
}

/** True if an IPv4 address is in a range we must never dial. */
function isBlockedV4(ip: string): boolean {
  const v4 = parseV4(ip);
  if (!v4) return true; // un-parseable v4 → fail closed
  const [a, b] = v4;
  // 0.0.0.0/8 — "this network" / unspecified (0.0.0.0 routes to local).
  if (a === 0) return true;
  // 127.0.0.0/8 — loopback.
  if (a === 127) return true;
  // 10.0.0.0/8 — RFC-1918 private.
  if (a === 10) return true;
  // 172.16.0.0/12 — RFC-1918 private (172.16 .. 172.31).
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — RFC-1918 private.
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 — link-local, includes cloud metadata 169.254.169.254.
  if (a === 169 && b === 254) return true;
  return false;
}

/** Normalise an IPv6 literal to a list of 16-bit hextet numbers, or
 *  null if it isn't a recognisable v6 form. Handles `::` compression
 *  and a trailing IPv4-mapped tail (e.g. ::ffff:1.2.3.4). */
function parseV6(ip: string): number[] | null {
  let s = ip;
  // Strip an IPv6 scope id (fe80::1%eth0) — irrelevant to range checks.
  const pct = s.indexOf("%");
  if (pct !== -1) s = s.slice(0, pct);

  // An embedded IPv4 tail contributes two hextets.
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  const maybeV4 = lastColon !== -1 ? s.slice(lastColon + 1) : "";
  if (maybeV4.includes(".")) {
    const v4 = parseV4(maybeV4);
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    s = s.slice(0, lastColon + 1); // keep the trailing colon for splitting
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;

  const toHextets = (chunk: string): number[] | null => {
    if (chunk.length === 0) return [];
    const out: number[] = [];
    for (const h of chunk.split(":")) {
      if (h.length === 0 || h.length > 4 || !/^[0-9a-fA-F]+$/.test(h)) return null;
      out.push(Number.parseInt(h, 16));
    }
    return out;
  };

  if (halves.length === 2) {
    const head = toHextets(halves[0] as string);
    const body = toHextets(halves[1] as string);
    if (head === null || body === null) return null;
    const known = head.length + body.length + tail.length;
    if (known > 8) return null;
    const zeros = new Array(8 - known).fill(0) as number[];
    return [...head, ...zeros, ...body, ...tail];
  }

  const head = toHextets(halves[0] as string);
  if (head === null) return null;
  const all = [...head, ...tail];
  if (all.length !== 8) return null;
  return all;
}

/** True if an IPv6 address is loopback / unspecified / ULA / link-local,
 *  or is an IPv4-mapped/compatible address wrapping a blocked v4. */
function isBlockedV6(ip: string): boolean {
  const h = parseV6(ip);
  if (!h) return true; // un-parseable v6 → fail closed

  // ::  (unspecified) and ::1 (loopback).
  const allZeroExceptLast = h.slice(0, 7).every((x) => x === 0);
  if (allZeroExceptLast && (h[7] === 0 || h[7] === 1)) return true;

  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d — delegate
  // the embedded v4 to the v4 classifier so 169.254.x etc. are caught.
  const firstFiveZero = h.slice(0, 5).every((x) => x === 0);
  if (firstFiveZero && (h[5] === 0xffff || h[5] === 0)) {
    const a = ((h[6] as number) >> 8) & 0xff;
    const b = (h[6] as number) & 0xff;
    const c = ((h[7] as number) >> 8) & 0xff;
    const d = (h[7] as number) & 0xff;
    // Only treat it as embedded v4 when it isn't the bare ::1 / :: we
    // already handled (h[6]/h[7] non-zero, or ::ffff:0.0.0.0).
    if (h[5] === 0xffff || h[6] !== 0 || h[7] !== 0) {
      return isBlockedV4(`${a}.${b}.${c}.${d}`);
    }
  }

  const first = h[0] as number;
  // fc00::/7 — unique-local (fc00 .. fdff).
  if ((first & 0xfe00) === 0xfc00) return true;
  // fe80::/10 — link-local.
  if ((first & 0xffc0) === 0xfe80) return true;

  return false;
}

/**
 * Classify a single IP string (the form node's dns.lookup / net.isIP
 * produce). Returns true for any address the adapter must refuse to
 * dial: loopback, RFC-1918 / ULA private, link-local (incl. the
 * 169.254.169.254 cloud-metadata endpoint), and the unspecified
 * address. Anything un-parseable fails closed (blocked).
 */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedV4(ip);
  if (kind === 6) return isBlockedV6(ip);
  // Some runtimes return IPv4-mapped forms isIP() reports as 0; try v6.
  if (ip.includes(":")) return isBlockedV6(ip);
  return true; // not a recognisable IP literal → fail closed
}

/**
 * Pre-flight an outbound URL before any socket is opened.
 *
 * Enforces https-only, then (for a hostname) resolves it and rejects if
 * ANY candidate IP is blocked; a bare IP literal is classified directly
 * with no DNS lookup. Fail-closed: a resolver throw maps to blocked_host
 * rather than leaking through.
 *
 * On success returns the host plus the resolved IPs so the caller can
 * pin the connection to exactly those addresses.
 */
export async function assertOutboundAllowed(
  url: string,
  resolve: HostResolver,
): Promise<OutboundDecision> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "blocked_scheme", detail: "endpoint_url is not a valid URL" };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "blocked_scheme",
      detail: `only https endpoints are allowed (got ${parsed.protocol})`,
    };
  }

  // URL.hostname keeps IPv6 literals in brackets; strip them for isIP.
  const rawHost = parsed.hostname;
  const host = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;

  // Bare IP literal — no DNS, classify directly.
  if (isIP(host) !== 0) {
    if (isBlockedIp(host)) {
      return { ok: false, reason: "blocked_host", detail: `endpoint IP ${host} is not allowed` };
    }
    return { ok: true, host, pinnedIps: [host] };
  }

  let ips: string[];
  try {
    ips = await resolve(host);
  } catch (e) {
    return {
      ok: false,
      reason: "blocked_host",
      detail: `DNS resolution failed for ${host}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (ips.length === 0) {
    return { ok: false, reason: "blocked_host", detail: `no addresses resolved for ${host}` };
  }
  for (const ip of ips) {
    if (isBlockedIp(ip)) {
      return {
        ok: false,
        reason: "blocked_host",
        detail: `${host} resolves to a disallowed address (${ip})`,
      };
    }
  }

  return { ok: true, host, pinnedIps: ips };
}
