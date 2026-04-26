# Distribution — v0 living doc

Scope TBD per the Track-2 prompt from 2026-04-23. Detail expanded in a
future session; this stub exists so cross-references from kickoff
documents and ADRs resolve to a real file rather than dangling.

## §4 — SDK as hypergrowth leverage

`@foxbook/sdk-ts` and the CLI are filed for **Day 7 / week 2** as the
hypergrowth leverage point per the agents-first onboarding thesis. The
goal: claim flow + revocation + firehose subscription become a five-line
developer-facing surface, so frictionless onboarding shifts from
"read the foundation doc and POST manually" to `import { claim } from
"@foxbook/sdk-ts"`.

The SDK depends on PR B's revocation contract being stable (the SDK
exposes `revoke()` from v0). Firehose subscription via the SDK depends
on PR D's wire-traffic learnings landing first.

Referenced from:
- ADR 0004 addendum (firehose emission pattern, PR D pin)
- Day-6 kickoff hard constraints
- Day-7 prep notes

Detail forthcoming.

## §7 — week-1 demo path

The week-1 demo audience is MCP / A2A / independent agent builders who
claim via GitHub handles. Tier 1 (Gist via GitHub handle) is the
load-bearing path; Tier 2 (DNS TXT + endpoint challenge) extends to
domain assets but is not on the demo critical path. The scraper is
**explicitly optional** for week-1; deferred to Day 7+ with no impact
on the week-1 narrative.

Detail forthcoming.
