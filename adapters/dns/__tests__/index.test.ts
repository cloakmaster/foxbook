// DNS DoH adapter tests — 8 discriminated statuses, all distinct,
// none collapsed to "error". Each branch exercises a recorded
// Cloudflare DoH response shape so the test is hermetic (no
// network).

import { describe, expect, it, vi } from "vitest";

import { extractFoxbookCode, verifyDnsTxtContainsCode } from "../src/index.js";

function mockFetchOnce(impl: typeof globalThis.fetch): typeof globalThis.fetch {
  return vi.fn(impl) as unknown as typeof globalThis.fetch;
}

const TARGET_DOMAIN = "acme.example";
const TARGET_CODE = "G2ZMPHK8DJ6S540HFNX792SAVPZ2SRSH";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/dns-json" },
  });
}

describe("verifyDnsTxtContainsCode — discriminated statuses", () => {
  it("match: TXT contains the exact verification code", async () => {
    const fetchImpl = mockFetchOnce(async () =>
      jsonResponse({
        Status: 0,
        TC: false,
        Answer: [
          {
            name: "_foxbook-claim.acme.example",
            type: 16,
            TTL: 300,
            data: `"foxbook-verification=${TARGET_CODE}"`,
          },
        ],
      }),
    );
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result).toEqual({ status: "match" });
  });

  it("not-found: NXDOMAIN (Status=3)", async () => {
    const fetchImpl = mockFetchOnce(async () => jsonResponse({ Status: 3, TC: false, Answer: [] }));
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result.status).toBe("not-found");
  });

  it("error/servfail: Status=2 (transient upstream)", async () => {
    const fetchImpl = mockFetchOnce(async () => jsonResponse({ Status: 2, TC: false, Answer: [] }));
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("servfail");
    }
  });

  it("error/truncated: TC bit set", async () => {
    const fetchImpl = mockFetchOnce(async () =>
      jsonResponse({
        Status: 0,
        TC: true,
        Answer: [
          {
            name: "_foxbook-claim.acme.example",
            type: 16,
            TTL: 300,
            data: '"foxbook-verification=partial"',
          },
        ],
      }),
    );
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("truncated");
    }
  });

  it("error/rate_limited: HTTP 429 from Cloudflare", async () => {
    const fetchImpl = mockFetchOnce(async () => new Response("rate limited", { status: 429 }));
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("rate_limited");
    }
  });

  it("error/timeout: fetch aborted before response", async () => {
    // Simulate timeout by aborting on signal; the adapter sets a
    // timeout that triggers the abort, and our mock fetch returns a
    // promise that rejects with AbortError when the signal fires.
    const fetchImpl: typeof globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = (init as RequestInit)?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          (e as Error & { name: string }).name = "AbortError";
          reject(e);
        });
      });
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
      timeoutMs: 20,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("timeout");
    }
  });

  it("still-pending: TXT records exist but none carry foxbook-verification=", async () => {
    const fetchImpl = mockFetchOnce(async () =>
      jsonResponse({
        Status: 0,
        TC: false,
        Answer: [
          {
            name: "_foxbook-claim.acme.example",
            type: 16,
            TTL: 300,
            data: '"some-other-record=hello"',
          },
        ],
      }),
    );
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result.status).toBe("still-pending");
  });

  it("identity-mismatch: foxbook-verification= present with a DIFFERENT code", async () => {
    const fetchImpl = mockFetchOnce(async () =>
      jsonResponse({
        Status: 0,
        TC: false,
        Answer: [
          {
            name: "_foxbook-claim.acme.example",
            type: 16,
            TTL: 300,
            data: '"foxbook-verification=NOTOURCODE12345678901234567890"',
          },
        ],
      }),
    );
    const result = await verifyDnsTxtContainsCode(TARGET_DOMAIN, TARGET_CODE, {
      fetch: fetchImpl,
    });
    expect(result.status).toBe("identity-mismatch");
    if (result.status === "identity-mismatch") {
      expect(result.foundCode).toBe("NOTOURCODE12345678901234567890");
    }
  });
});

describe("extractFoxbookCode — TXT parsing", () => {
  it("returns the code when the prefix matches", () => {
    expect(extractFoxbookCode("foxbook-verification=ABC123")).toBe("ABC123");
  });

  it("returns null for unrelated TXT records (SPF, DMARC, etc.)", () => {
    expect(extractFoxbookCode("v=spf1 -all")).toBeNull();
    expect(extractFoxbookCode("v=DMARC1; p=reject")).toBeNull();
    expect(extractFoxbookCode("")).toBeNull();
  });
});
