// 32-char Crockford base32 verification code minted at POST /claim/start.
//
// Crockford base32 is the same alphabet as did:foxbook ULIDs, so
// operators don't context-switch between "Foxbook codes" and "Foxbook
// DIDs". 32 chars × 5 bits = 160 bits of entropy — far exceeds
// birthday-resistance requirements and makes accidental collisions
// negligible even at 10^9 claims.
//
// We AVOID characters I, L, O, U (Crockford-excluded) so users don't
// transcribe I-vs-1 or 0-vs-O confusion.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32
const CODE_LEN = 32;

export function mintVerificationCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    // biome-ignore lint/style/noNonNullAssertion: bytes is fully initialised above
    out += ALPHABET[bytes[i]! % 32];
  }
  return out;
}
