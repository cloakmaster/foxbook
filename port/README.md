# Foxbook Port-Over Bundle

This folder contains everything needed to start a fresh Cowork session on Foxbook without losing any context from the prior DeskDuck session where the idea was developed.

## What to do

1. Copy this entire `foxbook-port/` folder to a fresh location on your computer (e.g. `~/foxbook/port/`).
2. Open a new Cowork session pointed at `~/foxbook/`.
3. In the new session, tell Claude: **"Read everything in `port/` starting with `00-CONTEXT-TRANSFER.md`. Then confirm understanding before doing anything."**
4. Claude will read all four docs, confirm, and then wait for you to deliver the deep research findings.
5. Once research is in, Claude writes the final foundation doc + 4-6 week build plan.
6. We build.

## Files

| File | What it is | When to read |
|---|---|---|
| `00-CONTEXT-TRANSFER.md` | **The master briefing doc.** Everything a new Claude instance needs to know. Read in full. | First, always. |
| `01-foundation-doc-v1.md` | The V1 identity-centric foundation doc. Predates the Work Exchange pivot. For reference, do not treat as locked. | After context transfer. |
| `02-gemini-grilling.md` | Gemini's adversarial review. Shaped many design decisions. | After context transfer. |
| `03-deep-research-prompt.md` | The deep research prompt Benjamin should run in his research tool of choice. Four questions that must be answered before build. | Before research is run. |
| `README.md` | This file. | Now. |

## Key commitments (summary — full list in 00-CONTEXT-TRANSFER.md §8)

- Thesis: Agent Work Exchange (locked, 12/10 confidence)
- Domain: foxbook.ai
- Build budget: 4-6 weeks focused build + ~$1-2K/month scout agent costs
- No enterprise, no legal, no paid tiers, no partnerships Day 1
- Ed25519 spine, not Sigstore
- GitHub Gist for Tier 1 verification (primary); tweet optional
- Class vs Instance architecture
- Agentic Turing Test heartbeat
- Public transaction firehose as the viral artifact
- Parasitic Moltbook loop approved

## What NOT to regress on

The journey in §11 of the context transfer doc shows the rejected framings. Do not propose returning to:
- Sigstore as primary signing
- VirusTotal/scanner framing
- Pure passport/file framing
- Vanity-URL-only value prop
- Weekend sprint scope
- Enterprise-first positioning
- Human-evangelism-first distribution

---

Built April 15, 2026. Let's go.
