import { describe, expect, it, vi } from "vitest";

import { extractGistOwner, type GistVerifyOptions, verifyGistContainsCode } from "../src/index.js";

function fakeFetch(responses: Array<Response | Error | "hang">): {
  fetch: GistVerifyOptions["fetch"];
  callCount: () => number;
} {
  let call = 0;
  return {
    fetch: ((_url: RequestInfo | URL, init?: RequestInit) => {
      const idx = call++;
      const r = responses[idx];
      if (!r) return Promise.reject(new Error(`no mocked response for call ${idx}`));
      if (r instanceof Error) return Promise.reject(r);
      if (r === "hang") {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }
      return Promise.resolve(r);
    }) as GistVerifyOptions["fetch"],
    callCount: () => call,
  };
}

describe("extractGistOwner", () => {
  it("parses gist.github.com/{owner}/{id}", () => {
    expect(extractGistOwner("https://gist.github.com/samrg472/abc123")).toBe("samrg472");
  });

  it("parses gist.githubusercontent.com/{owner}/{id}/raw", () => {
    expect(extractGistOwner("https://gist.githubusercontent.com/alice/abc123/raw")).toBe("alice");
  });

  it("returns null on non-Gist host", () => {
    expect(extractGistOwner("https://github.com/samrg472/repo")).toBeNull();
  });

  it("returns null on malformed URL", () => {
    expect(extractGistOwner("not a url")).toBeNull();
  });
});

describe("verifyGistContainsCode — identity guard (load-bearing)", () => {
  it("returns identity-mismatch when gist_url owner != expectedOwner AND issues zero fetches", async () => {
    const { fetch, callCount } = fakeFetch([]);
    const res = await verifyGistContainsCode(
      "https://gist.github.com/samrg472/abc123",
      "CODEXYZ",
      "alice",
      { fetch },
    );
    expect(res.status).toBe("identity-mismatch");
    expect(callCount()).toBe(0);
  });

  it("is case-insensitive on owner match", async () => {
    const response = new Response("here is the code CODEXYZ", { status: 200 });
    const { fetch, callCount } = fakeFetch([response]);
    const res = await verifyGistContainsCode(
      "https://gist.github.com/SAMRG472/abc123",
      "CODEXYZ",
      "samrg472",
      { fetch },
    );
    expect(res.status).toBe("match");
    expect(callCount()).toBe(1);
  });

  it("rejects malformed gist URL with error status and zero fetches", async () => {
    const { fetch, callCount } = fakeFetch([]);
    const res = await verifyGistContainsCode("not a gist url", "CODE", "alice", { fetch });
    expect(res.status).toBe("error");
    expect(callCount()).toBe(0);
  });
});

describe("verifyGistContainsCode — fetch status paths", () => {
  const gistUrl = "https://gist.github.com/samrg472/abc123";
  const expectedOwner = "samrg472";

  it("match: Gist body contains the code (among other text)", async () => {
    const response = new Response("hey everyone, my code is CODEXYZ, cool", { status: 200 });
    const { fetch } = fakeFetch([response]);
    const res = await verifyGistContainsCode(gistUrl, "CODEXYZ", expectedOwner, { fetch });
    expect(res.status).toBe("match");
  });

  it("still-pending: Gist fetched but code absent", async () => {
    const response = new Response("placeholder text no code yet", { status: 200 });
    const { fetch } = fakeFetch([response]);
    const res = await verifyGistContainsCode(gistUrl, "CODEXYZ", expectedOwner, { fetch });
    expect(res.status).toBe("still-pending");
  });

  it("not-found: Gist URL returns 404", async () => {
    const response = new Response("", { status: 404 });
    const { fetch } = fakeFetch([response]);
    const res = await verifyGistContainsCode(gistUrl, "CODEXYZ", expectedOwner, { fetch });
    expect(res.status).toBe("not-found");
  });

  it("error: fetch throws a non-abort error", async () => {
    const { fetch } = fakeFetch([new Error("network down")]);
    const res = await verifyGistContainsCode(gistUrl, "CODEXYZ", expectedOwner, { fetch });
    expect(res.status).toBe("error");
  });

  it("still-pending: fetch hangs past the timeout (AbortController fires)", async () => {
    vi.useFakeTimers();
    const { fetch } = fakeFetch(["hang"]);
    const promise = verifyGistContainsCode(gistUrl, "CODEXYZ", expectedOwner, {
      fetch,
      timeoutMs: 100,
    });
    await vi.advanceTimersByTimeAsync(200);
    const res = await promise;
    expect(res.status).toBe("still-pending");
    vi.useRealTimers();
  });
});
