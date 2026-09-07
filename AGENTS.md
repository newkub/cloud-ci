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

## Container runtime (Windows)

Docker Desktop is not installed — **Podman 6.1** (WSL provider) is the
container runtime. `C:` had no free space, so the machine store is a
junction: `C:\Users\Veerapong\.local\share\containers\podman\machine` →
`D:\pm`.

- `podman machine init` fails to pull the machine OS from quay.io on this
  machine — download the matching WSL rootfs manually from
  `github.com/podman-container-tools/podman-machine-os/releases` (asset
  `podman-machine.x86_64.wsl.tar.zst`) and run
  `podman machine init --image <path-to-tar.zst>`.
- Wrangler container builds need these env vars:

```sh
WRANGLER_DOCKER_BIN="C:\Users\Veerapong\AppData\Local\Programs\Podman\podman.exe"
DOCKER_HOST="npipe:////./pipe/docker_engine"
BUILDAH_FORMAT="docker"   # push docker-format manifests to registry.cloudflare.com
```

- `wrangler dev` does not support local containers on Windows — use
  `bun run dev:mock` for the dashboard and deploy to test remotely.

## Deploy blocker

`bunx wrangler deploy` fails at Worker upload with
`code: 10015 — You do not have access to use Artifacts`.
**Artifacts is in closed beta** — request access for account
`384988241a425d49c5980f2b87b842c9` via
`https://forms.gle/DwBoPRa3CWQ8ajFp7` before deploy/staging can succeed.
The `artifacts` binding + `cf.artifacts.repo.pushed` trigger are core to
this product and cannot be removed.

**Containers** also requires the **Workers Paid plan** (account is on Free):
`wrangler containers list` returns
`Unauthorized: You do not have access to Cloudflare Containers`.

## Staging

`wrangler.staging.jsonc` is a dashboard-only config for the current Free
plan — it drops `artifacts`, `triggers.events`, `containers`, and the
`SANDBOX` DO. Deploy with:

```sh
bunx wrangler deploy -c wrangler.staging.jsonc
```

Live at `https://cloud-ci-staging.newkubise.workers.dev` — `/health`,
`/rpc/*` (RunRegistry DO), and the SPA all work; CI/heal paths stay inert
until Artifacts + Paid plan are enabled.
