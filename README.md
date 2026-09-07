# cloud-ci

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/newkub/cloud-ci)

A self-healing Cloudflare CI Worker that extends the basic Cloudflare Artifacts
pipeline with an application-owned Healing Agent and a web dashboard. The agent
implementation, tools, safeguards, AI dependencies, and `CiRunFailedWithFix`
error all live in this project rather than in `@cloudflare/ci`.

The core package reports neutral runner diagnostics. `cloudflare.ci.ts` combines
those diagnostics with the Workflow event to create the local `HealFailure`
passed to the agent. Run and healing history is recorded in the `RunRegistry`
Durable Object and served through an oRPC API (`/rpc/*`) consumed by the Solid +
TanStack + UnoCSS dashboard in [`web/`](./web).

## Prerequisites

This project does not create a source repository for you. Before deploying, you
must already have a **Cloudflare Artifacts repository** set up and populated with
the source you want to build. The pipeline runs in response to pushes to that
repository, so it will never trigger until such a repository exists and receives
a push.

## Configure

The repository this pipeline builds is scoped by the trigger filter in
[`wrangler.jsonc`](./wrangler.jsonc):

- `artifacts[].namespace` — your Artifacts namespace.
- `triggers.events[].filter.namespace` — same namespace. This is what hooks the
  trigger to your repository; if it does not match, no pipeline ever starts.
- `triggers.events[].filter.repo_name` — your repository name. Same rule: a
  mismatch here means the trigger silently never fires.

Also provide both Cloudflare account IDs (`CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_DEPLOY_ACCOUNT_ID`), and use resource names that do not overlap
another deployed worker, particularly the Workflow, Worker, and backup bucket.

The deploy flow reads [`.dev.vars.example`](./.dev.vars.example) and prompts for
the runner and Sandbox backup secrets. To configure them manually:

```sh
bunx wrangler secret put CF_TOKEN
bunx wrangler secret put R2_ACCESS_KEY_ID
bunx wrangler secret put R2_SECRET_ACCESS_KEY
```

The `AI` binding and `HEALER` Durable Object are already declared in
`wrangler.jsonc`. Change `Healer.getModel()` in `cloudflare.ci.ts` to configure
the model used for Heal Attempts.

## Commands

```sh
bun test           # vitest
bun run typecheck  # wrangler types + tsc --noEmit
bun run build      # web build + wrangler deploy --dry-run
bun run dev:web    # vite dev server for the dashboard
bun run dev:worker # wrangler dev
bun run dev:mock   # serve /rpc with seeded data (no Artifacts access needed)
bun run cf-typegen # regenerate worker-configuration.d.ts
bun run deploy     # wrangler deploy
```

A verified fix is pushed to a `ci-autofix/<run-id>` Fix Branch and a pull
request is opened automatically. The source run still fails because its
original revision remains broken.
