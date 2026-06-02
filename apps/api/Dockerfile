# apps/api production image — Fly.io deploy target.
#
# Build with: pnpm --filter @foxbook/api start (delegates to tsx).
# No TS→JS pre-build step; tsx handles type-stripping at runtime.
# Trade-off: ~50ms slower cold start vs a built dist/ but much
# simpler workspace setup. Re-evaluate if cold-start ever measurably
# slips the firehose-staleness budget.

FROM node:22-alpine AS runtime

# corepack ships with Node 22; enable it for pnpm.
RUN corepack enable

WORKDIR /repo

# Copy the entire workspace. Image size optimization (multi-stage +
# selective copies) is filed for a future PR if registry pressure
# warrants it.
COPY . .

# Install deps for @foxbook/api and its workspace dependencies only.
# --frozen-lockfile pins versions exactly; if pnpm-lock.yaml is stale,
# the build fails fast (good — forces lockfile updates through PRs).
RUN pnpm install --frozen-lockfile --filter @foxbook/api...

# NOTE: image-slimming via `pnpm prune --prod` was reverted — in a
# non-interactive Docker build (no TTY) pnpm aborts the prune, and forcing it
# (CI=true) risks over-pruning a runtime dependency in this filtered-workspace
# install. Redo as a tested multi-stage / `pnpm install --prod` build with a
# runtime-dependency audit before re-enabling. `tsx` deliberately lives in
# @foxbook/api dependencies (not devDependencies) — the start command boots
# with `node --import tsx ./src/main.ts` and needs it at runtime.

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

# `start` script runs node --import tsx ./src/main.ts (no .env.local
# load — Fly injects secrets via env vars at boot). See
# apps/api/package.json for the script body.
CMD ["pnpm", "--filter", "@foxbook/api", "start"]
