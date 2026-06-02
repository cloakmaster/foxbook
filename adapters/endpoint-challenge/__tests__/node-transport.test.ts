// Connect-time SSRF pin tests. makeGuardedLookup wraps node:dns.lookup
// and re-applies isBlockedIp to the address the socket is about to dial
// — the layer that survives DNS rebinding (the pre-flight resolution and
// the real connection can disagree; whichever IP the socket actually
// gets is the one classified here). We drive it with a fake lookup so
// the block path is deterministic and offline.

import type dns from "node:dns";
import { describe, expect, it } from "vitest";

import { makeGuardedLookup } from "../src/node-transport.js";

/** A fake node:dns.lookup that yields a fixed result. Supports both the
 *  single-address and `all:true` array callback shapes. */
function fakeLookup(result: string | Array<{ address: string; family: number }>) {
  return ((_hostname: string, options: unknown, callback?: unknown): void => {
    const cb = (typeof options === "function" ? options : callback) as (
      err: NodeJS.ErrnoException | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number,
    ) => void;
    if (Array.isArray(result)) {
      cb(null, result);
    } else {
      cb(null, result, 4);
    }
  }) as typeof dns.lookup;
}

describe("makeGuardedLookup — connect-time IP pin", () => {
  it("blocks a single resolved address that is loopback (DNS-rebind defence)", () => {
    const lookup = makeGuardedLookup(fakeLookup("127.0.0.1"));
    let err: NodeJS.ErrnoException | null = null;
    lookup("rebind.evil", {}, (e: NodeJS.ErrnoException | null) => {
      err = e;
    });
    expect(err).not.toBeNull();
    expect((err as unknown as NodeJS.ErrnoException).code).toBe("EAI_BLOCKED");
  });

  it("blocks the cloud-metadata IP when returned in an all:true array", () => {
    const lookup = makeGuardedLookup(
      fakeLookup([
        { address: "93.184.216.34", family: 4 },
        { address: "169.254.169.254", family: 4 },
      ]),
    );
    let err: NodeJS.ErrnoException | null = null;
    lookup("rebind.evil", { all: true }, (e: NodeJS.ErrnoException | null) => {
      err = e;
    });
    expect(err).not.toBeNull();
    expect((err as unknown as NodeJS.ErrnoException).code).toBe("EAI_BLOCKED");
  });

  it("passes a public single address straight through", () => {
    const lookup = makeGuardedLookup(fakeLookup("93.184.216.34"));
    let err: NodeJS.ErrnoException | null = null;
    let address: unknown;
    lookup("acme.example", {}, (e: NodeJS.ErrnoException | null, addr: unknown) => {
      err = e;
      address = addr;
    });
    expect(err).toBeNull();
    expect(address).toBe("93.184.216.34");
  });

  it("passes a public all:true array through unchanged", () => {
    const records = [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ];
    const lookup = makeGuardedLookup(fakeLookup(records));
    let err: NodeJS.ErrnoException | null = null;
    let address: unknown;
    lookup("acme.example", { all: true }, (e: NodeJS.ErrnoException | null, addr: unknown) => {
      err = e;
      address = addr;
    });
    expect(err).toBeNull();
    expect(address).toEqual(records);
  });
});
