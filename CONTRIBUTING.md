# Contributing to Foxbook

Foxbook is in **stable / maintenance mode** (per [ADR 0008](docs/decisions/0008-stable-mode-maintenance-posture.md)). The protocol surface is the surface; new features are not being added.

## What's welcome

- **Bug reports.** Open an issue. Include the reproduction, the expected behavior, and what you observed. Security issues: email `hello@foxbook.dev` rather than opening a public issue.
- **Documentation fixes** (typos, broken links, clearer explanations). Open a PR; review may take weeks but it'll land.
- **Test additions** that exercise existing surfaces without changing them.
- **Forks under a different name** that extend the protocol. The Apache 2.0 license is permissive by design; the trademark on the **Foxbook** name is separate (see [TRADEMARK.md](TRADEMARK.md)). Rename your fork and you're welcome.

## What's not happening here

- **New features**, including new SDK functions, new endpoints, new schema shapes, or new tools (MCP server, CLI extras, additional language SDKs). These were considered and explicitly deferred under stable mode. ADR 0008 documents the freeze.
- **Spec extension requests.** Noted in the relevant Discussion thread; not actioned in this codebase. If you need a protocol extension, fork under a different name and ship it there.
- **Active roadmap.** There isn't one. The roadmap is "stay stable, stay live."

## Review timing

Maintainer focus is elsewhere. PRs are reviewed in batches; expect weeks, not days. Security issues are exceptions and are reviewed promptly.

## Security

Email `hello@foxbook.dev` for vulnerability reports. Do not open public issues for security-sensitive findings. Coordinated disclosure preferred; specific timeline negotiable.

## Code style

The repo uses Biome for TypeScript (`pnpm lint`), ruff for Python (`uv run ruff check`), and `go vet` for Go. Pre-commit hooks run these automatically; CI re-runs on PR. Match existing patterns rather than introducing new ones.

## Sign-off

No DCO / CLA required. Apache 2.0 contributions are accepted under the standard inbound=outbound convention.
