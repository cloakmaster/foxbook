# Trademark notice

**Foxbook** is a trademark of Benjamin [Last Name].

The protocol and the reference implementation in this repository are licensed
under the Apache License 2.0 (see [`LICENSE`](LICENSE)) — anyone can fork,
modify, and run their own deployment that satisfies the same protocol
contracts ([RFC-9162-shaped transparency log endpoints](docs/rfc-a2a-x-foxbook-extension.md);
JSON Schema in [`schemas/`](schemas/); cross-language test vectors in
[`schemas/crypto-test-vectors.json`](schemas/crypto-test-vectors.json)).

**The trademark is separate.** Use of the **"Foxbook"** name or logo in
association with derived implementations, competing services, hosted
deployments, or commercial offerings requires written permission. This
includes (non-exhaustive):

- Naming a fork or derivative service "Foxbook-X" / "X for Foxbook" /
  similar in a way that suggests endorsement or origin.
- Marketing a commercial verification service under the Foxbook name.
- Using the Foxbook logo on a website that's not the canonical
  reference deployment ([foxbook.dev](https://foxbook.dev) once the
  domain is live).

**What's explicitly OK without permission:**

- Forking the repo and running your own deployment under a different
  name. The protocol contracts are the canonical reference; the name is
  not load-bearing for interop.
- Referring to the Foxbook protocol or this reference implementation
  by name in documentation, blog posts, academic work, RFCs, or spec
  discussions (e.g., "we implement the Foxbook x-foxbook v1 extension").
  Nominative use is fine and encouraged.
- Distributing the source code, modified or unmodified, under the
  Apache License 2.0 terms.

**Why the trademark is separate from the source license:** the protocol's
canonicality value comes partly from a single canonical reference
deployment (the longest-audit-trail transparency log per
[ADR 0006 §2](docs/decisions/0006-protocol-not-marketplace.md)). Multiple
forks under the same trademark dilute that signal. Multiple forks under
their own names + interop-with-our-protocol is exactly the protocol-
not-marketplace future ADR 0006 wants. The license + trademark split
preserves both: maximally permissive code, modestly protected name.

For trademark licensing or clarification questions, contact
[@cloakmaster](https://github.com/cloakmaster) via GitHub.
