import { ulid } from "ulid";

export const DID_PREFIX = "did:foxbook:";
// ULID format per github.com/ulid/spec — 26 Crockford base32 chars, no padding.
const DID_REGEX = /^did:foxbook:[0-9A-HJKMNP-TV-Z]{26}$/;

/** Mint a fresh `did:foxbook:{ulid}`. Time-ordered, sortable. */
export function mintDid(): string {
  return `${DID_PREFIX}${ulid()}`;
}

/** Extract the ULID body from a did:foxbook: DID, or null if malformed. */
export function didToUlid(did: string): string | null {
  if (!DID_REGEX.test(did)) return null;
  return did.slice(DID_PREFIX.length);
}

export function isDidFoxbook(s: string): boolean {
  return DID_REGEX.test(s);
}
