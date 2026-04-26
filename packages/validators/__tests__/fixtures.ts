// Test fixtures for validator tests. Inline rather than file-backed so a
// reviewer can see the shape and the test in one place.

export const validXFoxbook = {
  did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
  foxbook_url: "https://foxbook.dev/anthropic.com/claude",
  verification_tier: 3,
  verified_asset: {
    type: "domain",
    value: "anthropic.com",
    verified_at: "2026-04-14T12:00:00Z",
    method: "dns_txt_plus_endpoint_challenge",
  },
  class_or_instance: "class",
  instance_uuid: null,
  version_hash: `sha256:${"a".repeat(64)}`,
  signatures: {
    ed25519_public_key_hex: "f".repeat(64),
    recovery_key_fingerprint: `sha256:${"b".repeat(64)}`,
    jws_signature: "eyJhbGciOiJFZERTQSJ9.eyJ9.x",
  },
  revoked: false,
  updated_at: "2026-04-15T11:47:02Z",
} as const;

export const validAgentCard = {
  name: "Claude Sonnet 4.5",
  description: "General-purpose AI assistant.",
  url: "https://api.anthropic.com/a2a/jsonrpc",
  version: "2026-04-15-abc1234",
  protocolVersion: "0.3.0",
  capabilities: { streaming: true, pushNotifications: false },
  skills: [{ id: "chat", name: "Chat", description: "Say hello" }],
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
} as const;

export const validFullManifest = {
  ...validAgentCard,
  "x-foxbook": validXFoxbook,
} as const;

export const validAgentKeyRegistrationLeaf = {
  leaf_type: "agent-key-registration",
  did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
  ed25519_public_key_hex: "a".repeat(64),
  recovery_key_fingerprint: `sha256:${"c".repeat(64)}`,
  published_at: "2026-04-23T10:00:00Z",
} as const;

// Day-6 PR B: revocation leaf shape per ADR 0004 + tl-leaf v1.1
// additive bump. The recovery_key_signature is a placeholder JWS
// string that satisfies the schema's regex (header.payload.signature
// in base64url) — real signatures are produced by core/src/crypto/jws.ts
// in production paths and exercised end-to-end via smoke:revoke.
export const validRevocationLeaf = {
  leaf_type: "revocation",
  did: "did:foxbook:01H8XS4WHV8YNGSZPQ5XK9QR6M",
  revoked_key_hex: "a".repeat(64),
  recovery_key_signature:
    "eyJhbGciOiJFZERTQSJ9.eyJsZWFmX3R5cGUiOiJyZXZvY2F0aW9uIn0.c2lnbmF0dXJlLXBsYWNlaG9sZGVy",
  revocation_timestamp: "2026-04-26T12:00:00Z",
  reason_code: "owner_request",
} as const;
