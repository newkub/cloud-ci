# cloud-ci

Self-healing CI pipeline on Cloudflare Workers. An Artifacts push trigger
starts a durable Workflow that runs install → lint/test/typecheck/build →
deploy in an isolated Sandbox. On failure, a Healing Agent (Workers AI +
`@cloudflare/think`) fixes the code inside a sandbox, re-verifies every failed
command, and pushes a `ci-autofix/<run-id>` Fix Branch plus a pull request.

A `RunRegistry` Durable Object (SQLite) records run lifecycle, failures, and
heal progress. A SolidJS + TanStack + UnoCSS dashboard in `web/` is served via
Worker Assets and talks to a type-safe oRPC API at `/rpc/*`.

## Layout

- `cloudflare.ci.ts` — `CI` workflow (pipeline definition) and `Healer` agent
- `src/index.ts` — Worker entry: `/health`, `/rpc/*` oRPC, asset fallback
- `src/registry.ts` — `RunRegistry` DO (runs + heals tables)
- `src/api/router.ts` — oRPC procedures (health, stats, runs, heals, watch)
- `src/healing/` — healing agent internals (sandbox, tools, push, prompts)
- `web/` — Vite SPA (SolidJS, TanStack Router/Query, oRPC client, UnoCSS)
- `wrangler.jsonc` — bindings: artifacts trigger, workflow, DOs, R2, AI, assets

## Rules

- Package manager is **Bun** — never use npm/pnpm/yarn commands or lockfiles.
- `bun.lock` is the lockfile; `package.json`, lockfiles, CI config, tests, and
  TypeScript/Wrangler config are protected paths the agent must not edit.
- Run `bun run cf-typegen` after changing `wrangler.jsonc` bindings so
  `worker-configuration.d.ts` stays in sync — never edit it by hand.
- Registry writes inside the Workflow must go through `step.do` with a
  deterministic step name so they stay durable across Workflow replay.
- DO stubs return promises — always `await` registry calls before checking
  results.

## Commands

```sh
bun install         # install deps
bun test            # vitest
bun run typecheck   # wrangler types --check + tsc --noEmit
bun run lint        # oxlint
bun run build       # web build + wrangler deploy --dry-run
bun run dev:web     # vite dev server (proxies /rpc to :8787)
bun run dev:worker  # wrangler dev (needs Artifacts access on the account)
bun run dev:mock    # in-memory /rpc server with seeded data
bun run deploy      # build + wrangler deploy (production — confirm first)
```

## Secrets

Required before deploy: `CF_TOKEN`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` — see `.dev.vars.example`.
