// Hand-written barrel. Re-exports the generated types so consumers can
// `import type { ... } from "@foxbook/types-ts"` without depending on filenames.
//
// Explicit named re-exports (rather than `export type *`) because
// json-schema-to-typescript inlines external $ref targets into the
// importing file, which would collide with the same type re-exported
// from its native file.

export type {
  A2AAgentCardFoxbookMirroredV1,
} from "./agent-card.js";
export type {
  DiscoveryResult,
  FoxbookDiscoveryAPIResponseV1,
} from "./discover-response.js";
export type {
  AgentRef,
  FoxbookFirehoseEnvelopeV1,
} from "./envelope.js";
export type {
  Did,
  Ed25519PublicKeyHex,
  FoxbookAgentCardExtensionXFoxbookV1,
  RecoveryKeyFingerprint,
  Sha256Hash,
} from "./x-foxbook.js";
