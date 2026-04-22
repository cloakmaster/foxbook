# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this directory actually is

**This is not the code repository.** `port/` is the planning + context-transfer bundle for **Foxbook** — the Agent Work Exchange (foxbook.dev). It sits alongside the code repo at `~/foxbook/` (one level up). There is no `package.json`, no `.git`, no test suite, no build system in here — work inside `port/` is reading, editing, and cross-referencing Markdown.

Repo layout:
```
~/foxbook/                         ← code repo root (git-initialised there)
├── CLAUDE.md                      ← guides work in the code repo
├── PROJECT-PLAN.md                ← week-by-week execution tracker
├── docs/foundation/
│   ├── LOCKED.md                  ← canonical (live-edit)
│   └── foxbook-foundation.md      ← canonical (live-edit)
└── port/                          ← YOU ARE HERE — reference bundle
    ├── CLAUDE.md                  ← this file (guides work inside port/)
    ├── CONTEXT-TRANSFER-V2.md
    ├── LOCKED.md                  ← frozen day-1 copy, do not live-edit
    ├── foxbook-foundation.md      ← frozen day-1 copy, do not live-edit
    ├── PROJECT-PLAN.md            ← frozen day-1 copy, do not live-edit
    ├── research-findings.md
    ├── repo-bootstrap/            ← historical (templates used on day 1)
    └── 00-/01-/02-/03-... stale & historical docs
```

**Canonical vs. frozen.** Once the code repo exists, live edits to the foundation doc, LOCKED commitments, or the plan happen at `~/foxbook/docs/foundation/` and `~/foxbook/PROJECT-PLAN.md`. The copies inside `port/` are a day-1 snapshot — leave them alone so we can always see the starting point. If you catch yourself editing `port/LOCKED.md`, you're in the wrong file.

---

## Reading order (do this before touching any doc)

1. **`CONTEXT-TRANSFER-V2.md`** — session → session handoff. Meta, tone, arc, locked decisions, open flags. Supersedes `00-CONTEXT-TRANSFER.md`.
2. **`LOCKED.md`** — one-page pin of commitments, SLOs, abandon triggers, explicit NOs. Reference on every design question.
3. **`foxbook-foundation.md`** — authoritative 19-section foundation doc. Everything is in here. All five of Benjamin's review patches applied (rating: 12/10).
4. **`PROJECT-PLAN.md`** — week-by-week execution tracker (4–6 week build starting 2026-04-21). Day-by-day for week 1.
5. **`research-findings.md`** — merged research synthesis. Consult when a research question arises.

**Stale — do not use:**
- `01-foundation-doc-v1.md` ("Sigil"-branded V1, entirely superseded by `foxbook-foundation.md`)
- `00-CONTEXT-TRANSFER.md` (session 1→2, superseded by V2)
- `research-findings-web-scan.md` (merged into `research-findings.md`)
- `02-gemini-grilling.md` and `03-deep-research-prompt.md` — historical only; all load-bearing critiques already absorbed.

`repo-bootstrap/` is historical. Its CLAUDE.md was the template copied to `~/foxbook/CLAUDE.md` on day 1; `CLAUDE-CODE-SETUP.md` is the one-time setup guide (MCP servers, slash commands, env vars) for that bootstrap. Don't edit files in here expecting them to take effect — the live version of that CLAUDE.md is at `~/foxbook/CLAUDE.md`.

---

## North star (pinned — supersedes all else)

> The first agent that hires another agent on the firehose and the transaction shows up publicly within 60 seconds — that's the moment. Everything else is plumbing.

Load-bearing SLO: **firehose staleness p95 <60s.** Any design change that puts p95 at risk is the wrong change.

---

## Who you're talking to

**Benjamin** (benshiib@gmail.com), solo founder. Previously built Inkog (launched, no traction — HN/Reddit alone doesn't work) and DeskDuck (parked; **zero code reuse** into Foxbook). Converged on Foxbook after 9+ deep research rounds.

**Communication style — internalize this before responding:**
- **Brutal honesty.** No hedging. No fence-sitting. No yes-manning. He asked for this explicitly and repeatedly.
- **Commit to a lane.** "Here's what I think you should do and why, though X could work if Y" beats "here are three options."
- **Pushback welcome.** He concedes when pushed back on with reasoning. He changes his mind correctly.
- **No enterprise-speak.** Ever. No "leverage synergies," no "compliance-as-a-service," no "transform your business." Culture is solo founder / vibe coder / Hugging Face / Figma / Lovable / Moltbook.
- **Minimal formatting in casual replies.** Prose where prose works. Bullets when multi-point structure earns its keep.
- **Budget:** $1–2K/mo infra (scouts) approved. Everything free for users in V1. No paid tiers until V3.
- **4–6 week build is committed.** He rejected the 2–3 week weekend-sprint framing as too rushed.

See `CONTEXT-TRANSFER-V2.md` §10 for "good vs bad Claude response" calibration examples.

---

## The decisions that are LOCKED (full list in `LOCKED.md`)

Do not re-open without explicit discussion and a foundation-doc update:

- **Thesis:** Agent Work Exchange (not identity registry, not scanner, not passport file, not compliance SKU).
- **Manifest:** A2A AgentCard superset with `x-foxbook` extensions. No parallel format.
- **Payment:** x402 canonical. AP2 / Stripe MPP secondary. No escrow — peer-to-peer settlement.
- **Crypto spine:** Ed25519 + JWS + own Merkle transparency log + `did:foxbook:{ULID}`. Sigstore = optional Tier 4 only.
- **Tier 1 verification:** GitHub Gist primary; tweet + email secondary.
- **Liveness:** Agentic Turing Test on every heartbeat (signed nonce + micro-reasoning puzzle). Server-only heartbeat rejected.
- **Namespace:** rooted to verified asset (domain / @X / gh:handle). Immutable `did:foxbook:{ULID}` underneath. No bare strings.
- **Composability V1:** metadata-only, single-hop x402 only. No `revenue_split_pct`. Multi-hop = separate firehose rows with own settlements. Automated splits = V2.
- **Firehose envelope:** frozen week 1, published at `foxbook.dev/schemas/envelope/v1.json`. Additive-only within v1.x. Breaking changes require `envelope_version` bump + ≥90-day deprecation.
- **Scout consent rule:** scouts transact only with Foxbook-registered agents OR agents publishing A2A AgentCards with explicit `pricing`. No scrape-to-transact.
- **Free forever V1.** Enterprise motion is V3.
- **Service-agnostic core rule:** core code has zero references to specific capabilities, rails, frameworks, or third-party services. All service-specific logic lives in adapters. Enforced in CI in the future repo. Adding an integration = zero core changes. This rule carried over from DeskDuck.

---

## Rejected framings (do not re-propose)

Sigstore as primary spine · VirusTotal/scanner framing · agent passport files · enterprise-first GTM · weekend-sprint build · bare-string namespaces · server-only heartbeat · proprietary manifest format · Moltbook cross-post as spine · VAIP citations (hallucinated IETF draft — real targets are IETF WIMSE + W3C DID Core) · HN/Reddit as primary distribution · paid tiers in V1 · compliance SKU in V1 · DeskDuck code reuse · Tweet-first Tier 1 · agents returning payment URLs · automated multi-hop splits in V1.

If tempted to resurrect any of these, re-read `LOCKED.md` "Explicit NOs" and `CONTEXT-TRANSFER-V2.md` §5 first.

---

## Research flags still pending (from `research-findings.md` §0)

- **Flag A:** Meta/Moltbook (March 2026) and Meta/Manus (Dec 2025) acquisitions — deep research claimed, not primary-source verified. Week-1 task.
- **Flag B:** VAIP — stripped as hallucination. Real alignment targets only (IETF WIMSE drafts, W3C DID Core).
- **Flag C:** Enterprise creep — actively rejected. Any research output pushing compliance-as-a-service revenue is filed for V3 consideration only.

---

## How to work in this directory

- **Editing docs:** edits must preserve the reading order above and not create a parallel source of truth. If something in `LOCKED.md`, `foxbook-foundation.md`, and `PROJECT-PLAN.md` disagree, the foundation doc wins and the others get aligned.
- **Date handling:** this bundle uses absolute dates (e.g. "2026-04-21"). Preserve that when editing — never introduce relative dates like "next Tuesday."
- **Stale docs:** leave them in place as historical record but don't cite them as authoritative. If you need to reference one, say "per the superseded V1 doc" so the provenance is clear.
- **When a design question arises:** check `LOCKED.md` → `foxbook-foundation.md` → `PROJECT-PLAN.md`. If covered, follow. If not, propose explicitly citing the adjacent section and wait for confirmation. Do not silently drift.
- **`repo-bootstrap/` is historical.** Its CLAUDE.md was copied to `~/foxbook/CLAUDE.md` on day 1. Edits here do not propagate. If guidance needs to change for the code repo, edit `~/foxbook/CLAUDE.md` directly.
- **Canonical foundation docs live at `~/foxbook/docs/foundation/`** once the code repo exists. The `port/LOCKED.md` and `port/foxbook-foundation.md` copies are frozen at day-1 state for historical reference — do not live-edit them.

---

## When in doubt

1. Check `LOCKED.md`.
2. Check `foxbook-foundation.md` (use the section headers from §0–§19 in §"Reading order").
3. Check `PROJECT-PLAN.md` for where we are in the timeline.
4. If still unclear, ask Benjamin with the specific section reference and your proposed answer.

**Do not silently drift. Do not re-open locked decisions under time pressure. Protect the 60-second moment.**
