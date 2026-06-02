// Endpoint signed-nonce adapter tests — match path with a real
// Ed25519 round-trip + the discriminated failure modes.

import { canonicalJsonBytes, generateKeypair, jwsSign } from "@foxbook/core";
import { describe, expect, it, vi } from "vitest";

import { verifyEndpointSignedNonce } from "../src/index.js";

function hexFromBytes(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i]?.toString(16).padStart(2, "0");
  return s;
}

const ENDPOINT_URL = "https://acme.example/.well-known/foxbook-challenge";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// All non-SSRF tests resolve the endpoint host to a public IP so the
// SSRF pre-flight passes and we exercise the JWS round-trip. SSRF
// tests below override this with private/loopback/metadata targets.
async function publicResolver(_host: string): Promise<string[]> {
  return ["93.184.216.34"];
}

describe("verifyEndpointSignedNonce — happy path", () => {
  it("match: Ed25519 round-trip with matching nonce", async () => {
    const keypair = generateKeypair();
    const nonce = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    let lastInit: RequestInit | undefined;
    const fetchImpl: typeof globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      lastInit = init;
      // Reference endpoint: signs canonical {nonce} with the signing
      // key, returns {jws}.
      const jws = jwsSign({ alg: "EdDSA", typ: "JWT" }, { nonce }, keypair.privateKey);
      return jsonResponse({ jws });
    }) as unknown as typeof globalThis.fetch;

    const result = await verifyEndpointSignedNonce(
      ENDPOINT_URL,
      nonce,
      hexFromBytes(keypair.publicKey),
      { fetch: fetchImpl, resolveHostname: publicResolver },
    );

    expect(result).toEqual({ status: "match" });
    // Verify the request body was canonical JSON of {nonce}.
    expect(lastInit).toBeDefined();
    expect(lastInit?.method).toBe("POST");
    expect(lastInit?.body).toBe(new TextDecoder().decode(canonicalJsonBytes({ nonce })));
  });
});

describe("verifyEndpointSignedNonce — failure paths", () => {
  it("signature-invalid: JWS verifies as invalid against a different keypair", async () => {
    const realKeypair = generateKeypair();
    const wrongKeypair = generateKeypair();
    const nonce = "deadbeef".repeat(8);
    const fetchImpl: typeof globalThis.fetch = (async () => {
      // Endpoint signs with the WRONG key.
      const jws = jwsSign({ alg: "EdDSA", typ: "JWT" }, { nonce }, wrongKeypair.privateKey);
      return jsonResponse({ jws });
    }) as unknown as typeof globalThis.fetch;

    const result = await verifyEndpointSignedNonce(
      ENDPOINT_URL,
      nonce,
      hexFromBytes(realKeypair.publicKey),
      { fetch: fetchImpl, resolveHostname: publicResolver },
    );

    expect(result.status).toBe("signature-invalid");
  });

  it("nonce-mismatch: signature valid but for a different nonce (replay defence)", async () => {
    const keypair = generateKeypair();
    const sentNonce = "aaaa".repeat(16);
    const replayedNonce = "bbbb".repeat(16);
    const fetchImpl: typeof globalThis.fetch = (async () => {
      // Endpoint signs an OLD nonce instead of the one we just sent.
      const jws = jwsSign(
        { alg: "EdDSA", typ: "JWT" },
        { nonce: replayedNonce },
        keypair.privateKey,
      );
      return jsonResponse({ jws });
    }) as unknown as typeof globalThis.fetch;

    const result = await verifyEndpointSignedNonce(
      ENDPOINT_URL,
      sentNonce,
      hexFromBytes(keypair.publicKey),
      { fetch: fetchImpl, resolveHostname: publicResolver },
    );

    expect(result.status).toBe("nonce-mismatch");
    if (result.status === "nonce-mismatch") {
      expect(result.sent).toBe(sentNonce);
      expect(result.received).toBe(replayedNonce);
    }
  });

  it("error/http_error: endpoint returns 500", async () => {
    const keypair = generateKeypair();
    const fetchImpl: typeof globalThis.fetch = (async () =>
      new Response("internal", { status: 500 })) as unknown as typeof globalThis.fetch;

    const result = await verifyEndpointSignedNonce(
      ENDPOINT_URL,
      "00".repeat(32),
      hexFromBytes(keypair.publicKey),
      { fetch: fetchImpl, resolveHostname: publicResolver },
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("http_error");
    }
  });

  it("error/missing_jws: response is JSON but lacks the jws field", async () => {
    const keypair = generateKeypair();
    const fetchImpl: typeof globalThis.fetch = (async () =>
      jsonResponse({ unrelated: "field" })) as unknown as typeof globalThis.fetch;

    const result = await verifyEndpointSignedNonce(
      ENDPOINT_URL,
      "00".repeat(32),
      hexFromBytes(keypair.publicKey),
      { fetch: fetchImpl, resolveHostname: publicResolver },
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("missing_jws");
    }
  });

  it("error/timeout: fetch aborted before response", async () => {
    const keypair = generateKeypair();
    const fetchImpl: typeof globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = (init as RequestInit)?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          (e as Error & { name: string }).name = "AbortError";
          reject(e);
        });
      });

    const result = await verifyEndpointSignedNonce(
      ENDPOINT_URL,
      "00".repeat(32),
      hexFromBytes(keypair.publicKey),
      { fetch: fetchImpl, timeoutMs: 20, resolveHostname: publicResolver },
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("timeout");
    }
  });

  it("error/decode_error: invalid publicKeyHex (non-hex chars)", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyEndpointSignedNonce(ENDPOINT_URL, "00".repeat(32), "not-hex-zz", {
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.reason).toBe("decode_error");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("verifyEndpointSignedNonce — SSRF guard (no fetch before vetting)", () => {
  const keypair = generateKeypair();
  const pubHex = hexFromBytes(keypair.publicKey);
  const NONCE = "00".repeat(32);

  it("rejects a non-https endpoint without fetching or resolving", async () => {
    const fetchImpl = vi.fn();
    const resolveSpy = vi.fn(async () => ["93.184.216.34"]);
    const result = await verifyEndpointSignedNonce("http://acme.example/x", NONCE, pubHex, {
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
      resolveHostname: resolveSpy,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toBe("blocked_scheme");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("rejects an endpoint that resolves to the cloud-metadata IP before fetching", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyEndpointSignedNonce("https://rebind.evil/x", NONCE, pubHex, {
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
      resolveHostname: async () => ["169.254.169.254"],
    });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toBe("blocked_host");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an endpoint that resolves to loopback before fetching", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyEndpointSignedNonce("https://localhost.evil/x", NONCE, pubHex, {
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
      resolveHostname: async () => ["127.0.0.1"],
    });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toBe("blocked_host");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an https URL pointed straight at a private IP literal", async () => {
    const fetchImpl = vi.fn();
    const result = await verifyEndpointSignedNonce("https://10.0.0.7/x", NONCE, pubHex, {
      fetch: fetchImpl as unknown as typeof globalThis.fetch,
      resolveHostname: async () => {
        throw new Error("literal IP must not be resolved");
      },
    });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toBe("blocked_host");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks a redirect (3xx) that points at a private host", async () => {
    const fetchImpl: typeof globalThis.fetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://169.254.169.254/latest/meta-data/" },
      })) as unknown as typeof globalThis.fetch;
    const result = await verifyEndpointSignedNonce(ENDPOINT_URL, NONCE, pubHex, {
      fetch: fetchImpl,
      resolveHostname: publicResolver,
    });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.reason).toBe("blocked_redirect");
  });

  it("requests with redirect:'manual' so fetch never auto-follows", async () => {
    let seenInit: RequestInit | undefined;
    const nonce = "11".repeat(32);
    const fetchImpl: typeof globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      seenInit = init;
      const jws = jwsSign({ alg: "EdDSA", typ: "JWT" }, { nonce }, keypair.privateKey);
      return jsonResponse({ jws });
    }) as unknown as typeof globalThis.fetch;
    const result = await verifyEndpointSignedNonce(ENDPOINT_URL, nonce, pubHex, {
      fetch: fetchImpl,
      resolveHostname: publicResolver,
    });
    expect(result).toEqual({ status: "match" });
    expect(seenInit?.redirect).toBe("manual");
  });

  it("still completes the round-trip for a normal public https endpoint", async () => {
    const nonce = "22".repeat(32);
    const fetchImpl: typeof globalThis.fetch = (async () => {
      const jws = jwsSign({ alg: "EdDSA", typ: "JWT" }, { nonce }, keypair.privateKey);
      return jsonResponse({ jws });
    }) as unknown as typeof globalThis.fetch;
    const result = await verifyEndpointSignedNonce(ENDPOINT_URL, nonce, pubHex, {
      fetch: fetchImpl,
      resolveHostname: publicResolver,
    });
    expect(result).toEqual({ status: "match" });
  });
});
