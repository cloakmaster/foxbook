// GitHub Gist Tier-1 verification adapter.
//
// Gist verification is a two-part authorization: (1) the agent posts
// a public Gist containing the verification code Foxbook minted at
// POST /api/v1/claim/start, and (2) Foxbook fetches that Gist via
// HTTPS (no auth, no API key, no credential surface) and string-
// matches the code.
//
// Identity guard (Day-5 critical):
// Gist verification is authorization evidence ONLY when the Gist's
// owner handle matches the claim's asset_value. Without this check,
// alice could point verify-gist at samrg472's public Gist — which
// anyone can read — containing a code alice minted, and get a
// tier1-verified badge on samrg472's identity. We extract the first
// path segment of gist_url (e.g. samrg472 from
// https://gist.github.com/samrg472/abc123...) and case-insensitive
// match against expectedOwner BEFORE any network fetch is issued.
// Mismatch returns {status: "identity-mismatch"} with zero side
// effects; the fetch never happens. The test for this asserts the
// mock fetch call count is 0.
//
// Poll shape:
//   - default timeout 10 s per fetch.
//   - AbortController timeout; no stuck connections.
//   - String-contains match (the agent can put other text around the
//     code; we don't demand exact equality). No regex over
//     user-supplied patterns.

export type GistVerifyStatus =
  | "match"
  | "not-found"
  | "still-pending"
  | "error"
  | "identity-mismatch";

export type GistVerifyResult = { status: GistVerifyStatus; body?: string; reason?: string };

export type GistVerifyOptions = {
  /** Per-fetch timeout. Defaults to 10_000 ms. */
  timeoutMs?: number;
  /** Inject a fetch impl for tests. Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/** Extract the first path segment of a Gist URL — that's the owner handle. */
export function extractGistOwner(gistUrl: string): string | null {
  try {
    const url = new URL(gistUrl);
    if (!/^gist\.github(usercontent)?\.com$/.test(url.hostname)) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Single Gist fetch + code match + identity guard. Returns a discriminated
 * status; the caller (POST /api/v1/claim/verify-gist) decides whether to
 * retry (`still-pending` + backoff) or finalize (`match` → tier1).
 */
export async function verifyGistContainsCode(
  gistUrl: string,
  code: string,
  expectedOwner: string,
  opts: GistVerifyOptions = {},
): Promise<GistVerifyResult> {
  // Identity guard runs BEFORE any network call. A mismatched owner
  // produces no side effects — no fetch, no log, no rate-limit cost.
  const owner = extractGistOwner(gistUrl);
  if (owner === null) {
    return { status: "error", reason: "gist_url did not parse as a Gist URL" };
  }
  if (owner.toLowerCase() !== expectedOwner.toLowerCase()) {
    return {
      status: "identity-mismatch",
      reason: `gist_url owner "${owner}" does not match claim asset_value "${expectedOwner}"`,
    };
  }

  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const rawUrl = rawGistUrl(gistUrl);

  try {
    const res = await fetchImpl(rawUrl, { signal: controller.signal });
    if (res.status === 404) return { status: "not-found" };
    if (!res.ok) {
      return { status: "error", reason: `gist fetch returned ${res.status}` };
    }
    const body = await res.text();
    if (body.includes(code)) {
      return { status: "match", body };
    }
    return { status: "still-pending", body };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { status: "still-pending", reason: "fetch timed out" };
    }
    return { status: "error", reason: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Canonical raw-content URL for a Gist. If the caller already passed
 * a gist.githubusercontent.com URL, keep it. Otherwise transform
 * gist.github.com/{owner}/{id} → gist.githubusercontent.com/{owner}/{id}/raw.
 */
function rawGistUrl(gistUrl: string): string {
  const url = new URL(gistUrl);
  if (url.hostname === "gist.githubusercontent.com") return gistUrl;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return gistUrl;
  const [owner, id] = parts;
  return `https://gist.githubusercontent.com/${owner}/${id}/raw`;
}
