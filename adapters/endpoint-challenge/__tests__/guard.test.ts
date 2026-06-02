// SSRF-guard unit tests. The endpoint-challenge adapter fetches an
// attacker-controlled URL (the claimant supplies endpoint_url over two
// unauthenticated POSTs), so EVERY outbound target must be vetted
// before a socket is opened: https-only, and the resolved IP must not
// land on cloud metadata / loopback / RFC-1918 / link-local / ULA
// space. These tests pin the classifier (isBlockedIp) and the URL/host
// validator (assertOutboundAllowed) — the two primitives the fetch
// path gates on.

import { describe, expect, it } from "vitest";

import { assertOutboundAllowed, isBlockedIp } from "../src/guard.js";

describe("isBlockedIp — IPv4", () => {
  it("blocks the cloud metadata endpoint 169.254.169.254", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true);
  });

  it("blocks the whole 169.254/16 link-local block", () => {
    expect(isBlockedIp("169.254.0.1")).toBe(true);
    expect(isBlockedIp("169.254.255.255")).toBe(true);
  });

  it("blocks loopback 127.0.0.0/8", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("127.1.2.3")).toBe(true);
  });

  it("blocks RFC-1918 private ranges", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("172.31.255.255")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
  });

  it("does NOT block 172.32.x (just outside the 172.16/12 block)", () => {
    expect(isBlockedIp("172.32.0.1")).toBe(false);
  });

  it("blocks the unspecified address 0.0.0.0", () => {
    expect(isBlockedIp("0.0.0.0")).toBe(true);
  });

  it("allows ordinary public IPv4", () => {
    expect(isBlockedIp("93.184.216.34")).toBe(false);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});

describe("isBlockedIp — IPv6", () => {
  it("blocks loopback ::1", () => {
    expect(isBlockedIp("::1")).toBe(true);
  });

  it("blocks the unspecified ::", () => {
    expect(isBlockedIp("::")).toBe(true);
  });

  it("blocks unique-local fc00::/7", () => {
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fd12:3456::1")).toBe(true);
  });

  it("blocks link-local fe80::/10", () => {
    expect(isBlockedIp("fe80::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 that wraps a private v4 (::ffff:169.254.169.254)", () => {
    expect(isBlockedIp("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("allows public IPv6", () => {
    expect(isBlockedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});

describe("assertOutboundAllowed — scheme + host validation", () => {
  // Resolver stub: maps hostnames to IP lists deterministically.
  function resolver(map: Record<string, string[]>) {
    return async (hostname: string): Promise<string[]> => {
      const ips = map[hostname];
      if (!ips) throw new Error(`ENOTFOUND ${hostname}`);
      return ips;
    };
  }

  it("rejects a non-https (http) URL without ever resolving", async () => {
    let resolved = false;
    const resolve = async (_h: string): Promise<string[]> => {
      resolved = true;
      return ["93.184.216.34"];
    };
    const r = await assertOutboundAllowed("http://acme.example/x", resolve);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_scheme");
    expect(resolved).toBe(false);
  });

  it("rejects file: / other schemes", async () => {
    const r = await assertOutboundAllowed("file:///etc/passwd", resolver({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_scheme");
  });

  it("rejects an https URL whose hostname resolves to a private IP", async () => {
    const r = await assertOutboundAllowed(
      "https://rebind.evil/x",
      resolver({ "rebind.evil": ["10.0.0.5"] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_host");
  });

  it("rejects when ANY resolved IP is private (multi-record poisoning)", async () => {
    const r = await assertOutboundAllowed(
      "https://mixed.evil/x",
      resolver({ "mixed.evil": ["93.184.216.34", "169.254.169.254"] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_host");
  });

  it("rejects an https URL pointed straight at a private IP literal (no DNS)", async () => {
    let resolved = false;
    const resolve = async (h: string): Promise<string[]> => {
      resolved = true;
      return [h];
    };
    const r = await assertOutboundAllowed("https://169.254.169.254/latest/meta-data/", resolve);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_host");
    // A literal IP host needs no DNS lookup.
    expect(resolved).toBe(false);
  });

  it("allows an https URL that resolves to a public IP, and returns the pinned IPs", async () => {
    const r = await assertOutboundAllowed(
      "https://acme.example/.well-known/foxbook",
      resolver({ "acme.example": ["93.184.216.34"] }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.host).toBe("acme.example");
      expect(r.pinnedIps).toEqual(["93.184.216.34"]);
    }
  });

  it("surfaces resolver failure as a blocked_host (fail-closed)", async () => {
    const r = await assertOutboundAllowed("https://nx.example/x", resolver({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("blocked_host");
  });
});
