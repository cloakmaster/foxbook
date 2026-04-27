// DNS TXT challenge Tier-2 verification adapter.
//
// Uses Cloudflare 1.1.1.1 DNS-over-HTTPS (DoH) via `fetch` so the
// adapter runs unchanged on Node, Cloudflare Workers, and Vercel
// Edge. Deliberately NOT `dns.resolveTxt` (Node-only) — the same
// adapter shape needs to work in any runtime that has fetch.
//
// Discriminated status (8-way; mirrors adapter-gist's pattern but
// with DNS-specific failure modes surfaced as distinct reasons so
// operators can tell SERVFAIL/NXDOMAIN/timeout apart):
//
//   match              TXT record contains the exact verification code
//   still-pending      TXT exists but the verification code isn't there yet
//   identity-mismatch  TXT exists with a foxbook-verification= prefix
//                      whose code differs from the expected one
//                      (someone else's claim sits on this domain)
//   not-found          NXDOMAIN — the (sub)domain doesn't exist; no
//                      retry sensible
//   error/servfail     SERVFAIL — transient upstream; retry sensible
//   error/truncated    DNS TC bit set; force a DoH POST retry would
//                      help but for v1 we surface as error
//   error/rate_limited HTTP 429 from the DoH endpoint
//   error/timeout      fetch aborted before response (default 10s)
//
// TXT records inside Foxbook are formatted as
//   foxbook-verification=<32-char-code>
// and live at the subdomain `_foxbook-claim.<domain>`. The
// extractFoxbookCode helper finds the verification code if present,
// returning null if the TXT contains no foxbook-verification= prefix
// (still-pending) and the parsed code otherwise.

export type DnsVerifyStatus =
  | "match"
  | "still-pending"
  | "identity-mismatch"
  | "not-found"
  | "error";

export type DnsVerifyErrorReason =
  | "servfail"
  | "truncated"
  | "rate_limited"
  | "timeout"
  | "doh_http_error"
  | "doh_decode_error"
  | "no_answer";

export type DnsVerifyResult =
  | { status: "match" }
  | { status: "still-pending" }
  | { status: "identity-mismatch"; reason: string; foundCode: string }
  | { status: "not-found" }
  | { status: "error"; reason: DnsVerifyErrorReason; detail?: string };

export type DnsVerifyOptions = {
  /** Per-fetch timeout. Defaults to 10_000 ms. */
  timeoutMs?: number;
  /** Inject a fetch impl for tests. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Override DoH endpoint. Defaults to Cloudflare 1.1.1.1. */
  dohEndpoint?: string;
  /** Override the subdomain prefix. Defaults to '_foxbook-claim'. */
  challengeSubdomain?: string;
};

/** DNS Status codes from RFC 1035 (only the ones we discriminate). */
const DNS_RCODE_NOERROR = 0;
const DNS_RCODE_SERVFAIL = 2;
const DNS_RCODE_NXDOMAIN = 3;

/** TXT record type number. */
const DNS_TYPE_TXT = 16;

const DEFAULT_DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CHALLENGE_SUBDOMAIN = "_foxbook-claim";
const FOXBOOK_TXT_PREFIX = "foxbook-verification=";

/** Cloudflare DoH JSON response (subset we use). */
type DohResponse = {
  Status: number;
  TC: boolean;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
};

/**
 * Strip surrounding quotes from a TXT record's `data` field. Cloudflare
 * returns TXT records as `"<contents>"` (literal double quotes), and
 * multi-string TXTs as `"<part1>" "<part2>"`. For Foxbook claims we
 * only care about single-string TXTs containing the prefix.
 */
function unwrapTxt(data: string): string {
  // Strip leading + trailing quotes; collapse adjacent `" "` joins.
  const trimmed = data.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/"\s+"/g, "");
  }
  return trimmed;
}

/**
 * If a TXT record string starts with `foxbook-verification=`, return
 * the code suffix; otherwise null. A null return means the TXT belongs
 * to a different system (SPF, DMARC, etc.) and is safe to ignore.
 */
export function extractFoxbookCode(txt: string): string | null {
  if (!txt.startsWith(FOXBOOK_TXT_PREFIX)) return null;
  return txt.slice(FOXBOOK_TXT_PREFIX.length);
}

/**
 * Look up the TXT record at `_foxbook-claim.<domain>` and check
 * whether it contains the expected verification code. Returns a
 * discriminated status; the caller decides whether to retry
 * (`still-pending` + backoff), fail (`identity-mismatch`), or proceed
 * (`match` → tier2).
 */
export async function verifyDnsTxtContainsCode(
  domain: string,
  code: string,
  opts: DnsVerifyOptions = {},
): Promise<DnsVerifyResult> {
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const endpoint = opts.dohEndpoint ?? DEFAULT_DOH_ENDPOINT;
  const subdomain = opts.challengeSubdomain ?? DEFAULT_CHALLENGE_SUBDOMAIN;
  const queryName = `${subdomain}.${domain}`;

  const url = new URL(endpoint);
  url.searchParams.set("name", queryName);
  url.searchParams.set("type", "TXT");

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url.toString(), {
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (res.status === 429) {
      return { status: "error", reason: "rate_limited" };
    }
    if (!res.ok) {
      return { status: "error", reason: "doh_http_error", detail: `HTTP ${res.status}` };
    }
    let body: DohResponse;
    try {
      body = (await res.json()) as DohResponse;
    } catch (e) {
      return {
        status: "error",
        reason: "doh_decode_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }

    if (body.TC === true) {
      return { status: "error", reason: "truncated" };
    }
    if (body.Status === DNS_RCODE_NXDOMAIN) {
      return { status: "not-found" };
    }
    if (body.Status === DNS_RCODE_SERVFAIL) {
      return { status: "error", reason: "servfail" };
    }
    if (body.Status !== DNS_RCODE_NOERROR) {
      return {
        status: "error",
        reason: "doh_http_error",
        detail: `unexpected DNS rcode ${body.Status}`,
      };
    }

    const txtRecords = (body.Answer ?? [])
      .filter((a) => a.type === DNS_TYPE_TXT)
      .map((a) => unwrapTxt(a.data));

    if (txtRecords.length === 0) {
      return { status: "error", reason: "no_answer" };
    }

    // Look for any foxbook-verification= record. Multiple TXTs at the
    // same name are RFC-legal; we walk them and discriminate.
    let firstFoxbookCode: string | null = null;
    for (const txt of txtRecords) {
      const found = extractFoxbookCode(txt);
      if (found === null) continue;
      if (found === code) {
        return { status: "match" };
      }
      if (firstFoxbookCode === null) firstFoxbookCode = found;
    }

    if (firstFoxbookCode !== null) {
      // A foxbook-verification= record exists, but with a different
      // code than the one we minted. This is identity-mismatch — a
      // different agent's claim sits on this domain.
      return {
        status: "identity-mismatch",
        reason: `_foxbook-claim TXT contains a different verification code than expected`,
        foundCode: firstFoxbookCode,
      };
    }

    // TXT records exist but none carry our prefix. The owner hasn't
    // published the verification code yet — caller polls.
    return { status: "still-pending" };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { status: "error", reason: "timeout" };
    }
    return {
      status: "error",
      reason: "doh_http_error",
      detail: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
