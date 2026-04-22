# Foxbook — Claude Code setup

How to configure Claude Code to execute the week-1 plan. Intended to be read top-to-bottom on day 1.

---

## Part 1 — The first prompt (paste verbatim after `git clone` + `cd foxbook`)

Before running this, make sure the repo contains:
- `CLAUDE.md` at the root (copied from `foxbook-port/repo-bootstrap/CLAUDE.md`)
- `docs/foundation/LOCKED.md` (copy of `foxbook-port/LOCKED.md`)
- `docs/foundation/foxbook-foundation.md` (copy of `foxbook-port/foxbook-foundation.md`)
- `PROJECT-PLAN.md` (copy of `foxbook-port/PROJECT-PLAN.md`)

Then paste this as the first prompt:

```
Read these four files in order before doing anything:
1. CLAUDE.md
2. docs/foundation/LOCKED.md
3. docs/foundation/foxbook-foundation.md
4. PROJECT-PLAN.md

Today is day 1 of week 1. Your job is to scaffold the monorepo per PROJECT-PLAN.md §"Day 1" with the service-agnostic core rule enforced from the first commit.

Concrete deliverables, in order:

1. Monorepo layout:
   /core/                  (pure logic, no third-party service deps)
   /adapters/x402/         (x402 payment rail)
   /adapters/ap2/          (AP2 payment rail)
   /adapters/mpp/          (Stripe MPP)
   /adapters/gist/         (GitHub Gist verification)
   /adapters/dns/          (DNS TXT challenge)
   /adapters/x/            (X/Twitter verification)
   /adapters/email/        (Email verification via Resend)
   /adapters/sigstore/     (Sigstore Tier 4)
   /adapters/langchain/    (LangChain shield)
   /adapters/crewai/       (CrewAI shield)
   /adapters/langgraph/    (LangGraph shield)
   /adapters/mastra/       (Mastra shield)
   /apps/web/              (Next.js 15 App Router — landing + profiles + discover UI)
   /apps/api/              (Next.js API routes or separate service for /api/v1/*)
   /apps/firehose/         (WebSocket fanout — Cloudflare Durable Objects)
   /apps/transparency/     (read-only Merkle log browser)
   /apps/scouts/           (5-10 scout agents, Python)
   /apps/scrapers/         (pre-population scraper)
   /packages/sdk-py/       (Python SDK)
   /packages/sdk-ts/       (TypeScript SDK)
   /packages/cli/          (foxbook CLI)
   /packages/shield/       (shared shield middleware core)
   /schemas/               (JSON Schemas — agent-card, x-foxbook, envelope, capabilities)
   /ops/infra/             (Terraform)
   /ops/load-test/         (k6 scripts)
   /docs/decisions/        (ADRs)
   /docs/foundation/       (copies of LOCKED.md + foxbook-foundation.md)
   /docs/retros/           (weekly retros)

2. Toolchain:
   - pnpm workspaces + turborepo at repo root
   - TypeScript strict, biome for lint+format
   - Python via uv + ruff for apps/scouts and apps/scrapers and packages/sdk-py
   - Drizzle for Postgres migrations (schema in /packages/db or /core/db)
   - Vitest for TS tests; pytest for Python

3. Core-isolation lint rule:
   - Write a lightweight eslint plugin or biome custom rule (or a simple node script invoked in CI via pnpm turbo check:core-isolation) that fails if any file under /core/**/*.ts imports from ../adapters or from any of the banned service identifiers (x402, anthropic, openai, coinbase, langchain, github, etc.).
   - Add a deliberately-failing test fixture that imports from an adapter inside /core/, then add an expect-failure CI step that confirms the rule catches it. Remove the fixture before commit.
   - Document in docs/decisions/0001-service-agnostic-core.md.

4. First ADR: 0001-service-agnostic-core.md
   - Why the rule exists (carried over from DeskDuck; saves from N pivots when protocols shift)
   - What it enforces (no core->adapters imports, no banned identifiers in core)
   - How it's enforced (CI rule)
   - When it can be violated (only with another ADR and Benjamin's explicit sign-off)

5. CI:
   - GitHub Actions workflow: install + lint + typecheck + test + core-isolation check.
   - All green on empty scaffold before first push to main.

6. GitHub repo settings:
   - Main branch protection: PR required, required status checks, no force push.
   - CODEOWNERS at root with Benjamin as owner of /core and /schemas.

Before you start writing code, print a one-paragraph plan of the exact order you'll do these in and any deviations you want to flag. Wait for me to say "go" before executing. After each deliverable, check off the corresponding item in PROJECT-PLAN.md §"Day 1" with a git commit message that references the section.

Do not re-open design decisions. Do not propose enterprise features, compliance SKUs, paid tiers, or any of the rejected framings in LOCKED.md / foxbook-foundation.md §4. If you're tempted, re-read the rejected list and pick something else.
```

---

## Part 2 — MCP servers (what to install, when)

Claude Code reads MCP config from `~/.claude.json` (user scope) or `.mcp.json` at the repo root (project scope). Project scope is preferred for Foxbook so the config travels with the repo.

### Day 1 — install these first

**GitHub MCP** — essential. Used for PR creation, issue management, code search across the repo, and cross-checking the hero agent sheet against existing GitHub orgs.
```
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```
Auth via `GITHUB_PERSONAL_ACCESS_TOKEN` env var. Scope: `repo`, `read:org`, `workflow`.

**Context7** (or Ref) — docs lookup for A2A, MCP, x402, W3C DID Core, IETF WIMSE, Next.js 15, Drizzle, Cloudflare Durable Objects. Current docs reduce hallucination on spec details.
```
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

### Day 2-3 — add when hosting lands

**Neon MCP** — Postgres schema inspection, query, migration preview without leaving Claude Code.
```
claude mcp add neon -- npx -y @neondatabase/mcp-server-neon
```

**Cloudflare MCP** — DNS records, Workers deploys, Durable Object inspection, R2 bucket management. You already have this in Cowork; mirror the config to Claude Code.

**Vercel MCP** — deploy status, env var management, runtime log queries.

**Sentry MCP** — error triage, issue linking, release tracking.

### Week 2+ — add as needed

**Playwright MCP** — the Moltbook scraper (logged-off, Bright Data shield) and general browser automation for verification endpoints. `claude mcp add playwright -- npx -y @playwright/mcp`.

**Postgres-MCP (generic)** — if Neon MCP gaps appear, fall back to a generic Postgres MCP.

### What NOT to install

- Any MCP that wraps paid-tier-only APIs — V1 is free-forever for users.
- Any MCP for Slack/Teams/Asana/Notion — not load-bearing for the build, and noise in Claude Code's tool surface slows every turn.
- Anthropic/OpenAI/Google MCPs (if they exist) — the crypto + Merkle log + discovery API don't need model-provider-specific surfaces.

---

## Part 3 — Slash commands to create in `.claude/commands/`

Custom slash commands are reusable prompts. Keep them short. Each is a file under `.claude/commands/<name>.md`.

### `.claude/commands/locked-check.md`

```
Before you commit or open a PR for a non-trivial change:
1. Read docs/foundation/LOCKED.md end-to-end.
2. Identify any commitments, SLOs, or explicit NOs that the pending change intersects.
3. For each intersection, state: (a) which commitment, (b) whether the change complies, (c) if not, what would need to change (either in the code or with Benjamin's sign-off) to comply.
4. If everything complies, say "LOCKED-check passes" and list the commitments you checked.
5. If anything conflicts, stop and raise it.
```

Use: `/locked-check` before every PR.

### `.claude/commands/north-star.md`

```
Look at the most recent changes (git diff main...HEAD). For each change, answer:
1. Does it affect the hire→settle→firehose publish path?
2. If yes, could it add latency to firehose p95 staleness?
3. If yes, what's the worst-case p95 impact and how do we measure?
Be specific. Don't hand-wave. If there's no effect, say so plainly.
```

Use: `/north-star` after significant changes to the firehose, report pipeline, or Merkle log.

### `.claude/commands/adr.md`

```
Write an ADR for the pending architectural decision. Format:
- Number: next in sequence from docs/decisions/
- Date: today (YYYY-MM-DD)
- Title: short imperative
- Status: proposed | accepted | superseded
- Context: what problem, what constraints from LOCKED.md + foundation doc apply
- Decision: what we picked
- Consequences: what follows, what we've ruled out
- Alternatives: other options with one-line "why not"
Keep to one page. Commit it with the change.
```

Use: `/adr` any time a non-trivial architectural call gets made.

### `.claude/commands/retro.md`

```
Fill out this week's retro using the template in PROJECT-PLAN.md §"Weekly retro template". Pull shipped/slipped items from git log, count against abandon triggers and SLOs using actual measurements where available, and flag any drift toward rejected framings (LOCKED.md "Explicit NOs"). Save to docs/retros/week-NN.md.
```

Use: `/retro` every Monday night.

---

## Part 4 — Built-in Claude Code commands you'll use

- **`/init`** — already done (CLAUDE.md exists). Do not re-run.
- **`/review`** — PR review. Use before merging any PR that isn't trivial. Especially useful for the Merkle log, key rotation, and signature verification paths.
- **`/security-review`** — run before merging anything that touches crypto, signatures, DID resolution, or verification challenges. Mandatory for the Ed25519/JWS/Merkle log paths.
- **`/clear`** — when a conversation gets long and you want to reset with fresh context but keep CLAUDE.md loaded.
- **`/compact`** — when you need to preserve recent work but shrink the transcript.

---

## Part 5 — Plugins

Claude Code plugins group skills + slash commands + MCPs into installable bundles. For week 1, **don't create a plugin yet.** The commands in Part 3 live in `.claude/commands/` in the repo, which is simpler and versioned with the code.

**Revisit in week 4:** once the slash commands stabilize, consider bundling them into a `foxbook` plugin for anyone who forks the repo. Benjamin already has `cowork-plugin-management:create-cowork-plugin` skill available in Cowork if he wants to scaffold one later.

---

## Part 6 — Environment secrets (set these before running the first prompt)

Locally (in a `.env.local` not committed):

```
GITHUB_PERSONAL_ACCESS_TOKEN=...        # for GitHub MCP
NEON_API_KEY=...                        # for Neon MCP (day 2+)
CLOUDFLARE_API_TOKEN=...                # for Cloudflare MCP
VERCEL_TOKEN=...                        # for Vercel MCP
SENTRY_AUTH_TOKEN=...                   # for Sentry MCP
RESEND_API_KEY=...                      # for transactional email (day 2)
```

In Vercel (prod + staging):

```
DATABASE_URL                            # Neon
UPSTASH_REDIS_REST_URL                  # Upstash
UPSTASH_REDIS_REST_TOKEN
CLOUDFLARE_ACCOUNT_ID                   # for DO bindings
FOXBOOK_SIGNING_KEY                     # Foxbook's own Ed25519 key (KMS-backed in prod)
SENTRY_DSN
AXIOM_TOKEN                             # logs
```

**Nothing crypto-private goes in plaintext env.** Production signing keys live in AWS KMS or Cloudflare Workers Secrets. The env var holds the KMS key ARN / binding name, not the key material.

---

## Part 7 — The day-1 checklist (print this, tick as you go)

Morning:
- [ ] DNS registered (foxbook.dev, apex + www) at Cloudflare.
- [ ] GitHub org + repo created.
- [ ] Local `.env.local` populated with tokens above.
- [ ] CLAUDE.md, LOCKED.md, foxbook-foundation.md, PROJECT-PLAN.md copied into the repo.
- [ ] GitHub MCP + Context7 installed in Claude Code.

Run the first prompt (Part 1). Expected duration: 2-4 hours for Claude Code to scaffold + CI green.

Evening:
- [ ] Monorepo layout matches the spec.
- [ ] Core-isolation lint rule in CI. Deliberately-failing fixture confirms it catches violations, then fixture removed.
- [ ] ADR 0001 committed.
- [ ] First push to main green.
- [ ] Hero outreach sheet opened. 25 names drafted. 5 DMs sent.
- [ ] Designer DMs sent (2 leads).

Before bed:
- [ ] Skim the Claude Code transcript. If anything in the session drifted from LOCKED.md, open an issue now while it's fresh.
- [ ] Set tomorrow's top-3 in PROJECT-PLAN.md margin: Neon schema, crypto primitives, Resend.

---

**One last thing.** The first prompt (Part 1) ends with "Wait for me to say 'go' before executing." This is deliberate. Benjamin reads Claude Code's plan, catches any interpretation error, and only then releases execution. Don't skip that checkpoint.

Go build.
