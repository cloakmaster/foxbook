# Identity-guard live-proof — `cloakmaster` → `samrg472` rejected at 409

**Timestamp:** 2026-04-24T07:04:34.080Z (claim start) → 2026-04-24T07:??:??Z (verify-gist response)
**Environment:** apps/api on Neon dev, local dev loopback at http://localhost:8787
**Claim id:** `4661f254-f258-48dc-a856-e63dcc836536`
**Outcome:** 409 identity-mismatch, zero side effects, Merkle log untouched

## What happened

First live smoke-test run of Day 5 Gate 2 used `--asset-value samrg472` (the foundation §6.1 example handle) against a running API. Claim minted cleanly:

```
✓ /claim/start → 201
  claim_id:           4661f254-f258-48dc-a856-e63dcc836536
  agent_did:          did:foxbook:01KPZ4VXPYDJJ81S8XJKERD8NW
  verification_code:  J54ZN70JA88VJ0Y2WGJCQBHBZMQ2RFAY
```

Tester (operating as GitHub `@cloakmaster`) created a public Gist at
`https://gist.github.com/cloakmaster/18268a442f766525dd6bc12d4399a562`
containing the `verification_code`. The Gist was fully public, served the
expected content, and would have passed a naive string-contains match.

Pasted the `cloakmaster` Gist URL into the smoke-test's verify-gist prompt.
The API responded:

```
→ /claim/verify-gist → 409
  body: {
    "status": "identity-mismatch",
    "reason": "gist_url owner \"cloakmaster\" does not match claim asset_value \"samrg472\""
  }
```

Merkle log untouched. No `/claim/verify-gist` fetch to GitHub was issued —
the adapter's identity guard fires before the fetch when the URL-owner
segment doesn't match the claim's `asset_value`.

## Why this is load-bearing

Without the identity guard, the attack path is trivial: `cloakmaster` reads
the verification code from his own `/claim/start` response (which, in a
real scenario, would be for an attempt to claim `samrg472`), pastes it
into his own public Gist, and submits the URL. The Gist is anonymously
readable — the adapter fetches it, finds the code, returns `match`. Merkle
leaf gets written binding `did:foxbook:X → samrg472 asset` under
`cloakmaster`'s keypair. `samrg472` is now impersonated on Foxbook under
`cloakmaster`'s Ed25519 signing key.

The guard structurally prevents this: **the claim's `asset_value` must
equal the Gist URL's first path segment (case-insensitive), and the
comparison runs BEFORE any HTTP fetch.** This is the `fetchCount === 0`
assertion in `adapters/gist/__tests__/verify.test.ts`.

## Code paths that caught it

- **`adapters/gist/src/index.ts` — `extractGistOwner(url)`:** parses the
  Gist URL, rejects non-Gist hosts, returns the first path segment.
- **`adapters/gist/src/index.ts` — `verifyGistContainsCode()`:** runs the
  owner check as the FIRST step. On mismatch, returns
  `{status: "identity-mismatch", reason: ...}` without issuing the
  `fetch(rawUrl)` call. Asserted in the unit test as `callCount() === 0`
  after an identity-mismatch invocation.
- **`apps/api/src/claim/handlers.ts` — `claimVerifyGist()`:** gates on
  `claim.assetType === "github_handle"` before calling the adapter,
  passes `claim.assetValue` as `expectedOwner`. On `identity-mismatch`,
  returns 409 with the status passed through; **does NOT transition claim
  state, does NOT call `merkleRepository.append`.** The
  `appendSpy.callCount === 0` assertion in
  `apps/api/__tests__/claim.test.ts` is the unit-test counterpart of what
  this live event demonstrated.

## What this evidence is for

Week-3 load-test day will write artifacts per SLO. This file is a
different category: it's the first **production authorization-boundary
event**. The kind of evidence you point at when someone asks "but has the
identity guard ever actually caught anything in real traffic?"

The Merkle log, by design, has no record of this event — the append path
was structurally blocked before it ran. That's the feature. But the event
matters for week-1 retrospective + audit purposes: *the adversarial shape
was tried, live, against production infrastructure, and the guard held*.

Keep this file permanent. Do not truncate.

## References

- Adapter implementation + identity check: `adapters/gist/src/index.ts`
- Adapter test pinning `fetchCount === 0` on mismatch:
  `adapters/gist/__tests__/verify.test.ts`
- Handler integration + `appendSpy.callCount === 0` assertion:
  `apps/api/src/claim/handlers.ts`, `apps/api/__tests__/claim.test.ts`
- Schema-level partial UNIQUE protecting against race-based duplicate
  claims: `packages/db/src/schema/claims.ts` (`claims_asset_uniq_idx`)
