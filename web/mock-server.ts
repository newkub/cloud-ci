// Dev-only mock for `wrangler dev` when Artifacts access is unavailable.
// Serves the real oRPC router at :8787 with an in-memory REGISTRY stub seeded
// with sample data so the dashboard can be exercised end to end.
// Run: bun run web/mock-server.ts
import { RPCHandler } from '@orpc/server/fetch';
import type { Bindings } from '../env';
import { router } from '../src/api/router';
import type {
  HealListInput,
  HealRecord,
  RegistryStats,
  RunListInput,
  RunRecord,
} from '../src/registry';

const now = Date.now();
const HOUR = 3_600_000;
const MIN = 60_000;

const runs: RunRecord[] = [
  {
    id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    owner: 'newkub',
    repo: 'cloud-ci',
    ref: 'refs/heads/main',
    branch: 'main',
    sha: 'f7e8d9c0b1a2f7e8d9c0b1a2f7e8d9c0b1a2f7e8',
    trigger: 'push',
    actor: 'veerapong',
    message: 'feat: add healing dashboard',
    status: 'healed',
    failures: [
      {
        runner: { name: 'typecheck', command: 'bun run typecheck' },
        output:
          'src/registry.ts(112,5): error TS2345: Argument of type ... is not assignable\nerror: script "typecheck" exited with code 1',
      },
    ],
    createdAt: now - 2 * HOUR,
    finishedAt: now - 2 * HOUR + 14 * MIN,
  },
  {
    id: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
    owner: 'newkub',
    repo: 'cloud-ci',
    ref: 'refs/heads/main',
    branch: 'main',
    sha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    trigger: 'push',
    actor: 'devin',
    message: 'fix: protect package scripts from healing',
    status: 'success',
    failures: [],
    createdAt: now - 5 * HOUR,
    finishedAt: now - 5 * HOUR + 9 * MIN,
  },
  {
    id: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
    owner: 'newkub',
    repo: 'cloud-ci',
    ref: 'refs/heads/feat/registry',
    branch: 'feat/registry',
    sha: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00',
    trigger: 'push',
    actor: 'veerapong',
    message: 'wip: registry tables',
    status: 'failed',
    failures: [
      {
        runner: { name: 'test', command: 'bun run test' },
        output:
          '✗ src/healing/push.test.ts > pushes fix branch\n  expected "pushed" but got "no_changes"',
      },
      {
        runner: { name: 'lint', command: 'bun run lint', cwd: 'web' },
        output: 'web/src/ui.tsx(4,10): eslint(no-unused-vars): JSX',
      },
    ],
    createdAt: now - 26 * HOUR,
    finishedAt: now - 26 * HOUR + 11 * MIN,
  },
  {
    id: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
    owner: 'newkub',
    repo: 'cloud-ci',
    ref: 'refs/heads/main',
    branch: 'main',
    sha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    trigger: 'push',
    actor: 'devin',
    message: 'chore: bump deps',
    status: 'healing',
    failures: [
      {
        runner: { name: 'build', command: 'bun run build' },
        output: 'web build failed: module "virtual:uno.css" not found',
      },
    ],
    createdAt: now - 6 * MIN,
    finishedAt: null,
  },
  {
    id: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    owner: 'newkub',
    repo: 'cloud-ci',
    ref: 'refs/tags/v0.1.0',
    branch: null,
    sha: '0123456789abcdef0123456789abcdef01234567',
    trigger: 'tag',
    actor: 'veerapong',
    message: 'release v0.1.0',
    status: 'heal_failed',
    failures: [
      {
        runner: { name: 'test', command: 'bun run test' },
        output: 'flaky network in sandbox exec',
      },
    ],
    createdAt: now - 50 * HOUR,
    finishedAt: now - 50 * HOUR + 40 * MIN,
  },
];

const heals: HealRecord[] = [
  {
    runId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    status: 'pushed',
    steps: 12,
    branch: 'ci-autofix/a1b2c3d4e5f6',
    commit: 'f7e8d9c0b1a2f7e8d9c0b1a2f7e8d9c0b1a2f7e8',
    prUrl: 'https://github.com/newkub/cloud-ci/pull/7',
    prNumber: 7,
    error: null,
    startedAt: now - 2 * HOUR + 9 * MIN,
    finishedAt: now - 2 * HOUR + 14 * MIN,
  },
  {
    runId: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
    status: 'running',
    steps: 4,
    branch: null,
    commit: null,
    prUrl: null,
    prNumber: null,
    error: null,
    startedAt: now - 2 * MIN,
    finishedAt: null,
  },
  {
    runId: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    status: 'failed',
    steps: 25,
    branch: null,
    commit: null,
    prUrl: null,
    prNumber: null,
    error: 'Reached max steps without a verified fix.',
    startedAt: now - 50 * HOUR + 10 * MIN,
    finishedAt: now - 50 * HOUR + 40 * MIN,
  },
];

const registry = {
  recordRunStart: () => Promise.resolve(true),
  recordRunFinish: () => Promise.resolve(true),
  recordHealStart: () => Promise.resolve(true),
  recordHealProgress: () => Promise.resolve(true),
  recordHealFinish: () => Promise.resolve(true),
  listRuns(input: RunListInput = {}) {
    const items = input.status
      ? runs.filter((run) => run.status === input.status)
      : runs;
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 50;
    return Promise.resolve({
      items: items.slice(offset, offset + limit),
      total: items.length,
    });
  },
  getRun({ id }: { id: string }) {
    const run = runs.find((entry) => entry.id === id);
    if (!run) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      ...run,
      heal: heals.find((heal) => heal.runId === id) ?? null,
    });
  },
  listHeals(input: HealListInput = {}) {
    const items = input.status
      ? heals.filter((heal) => heal.status === input.status)
      : heals;
    const offset = input.offset ?? 0;
    const limit = input.limit ?? 50;
    return Promise.resolve({
      items: items.slice(offset, offset + limit),
      total: items.length,
    });
  },
  getHeal({ runId }: { runId: string }) {
    return Promise.resolve(
      heals.find((heal) => heal.runId === runId) ?? null
    );
  },
  stats(): Promise<RegistryStats> {
    const count = (status: string) =>
      runs.filter((run) => run.status === status).length;
    const healCount = (status: string) =>
      heals.filter((heal) => heal.status === status).length;
    return Promise.resolve({
      totalRuns: runs.length,
      running: count('running'),
      succeeded: count('success'),
      failed: count('failed'),
      healing: count('healing'),
      healed: count('healed'),
      healFailed: count('heal_failed'),
      totalHeals: heals.length,
      healsPushed: healCount('pushed'),
      healsRunning: healCount('running'),
      healsFailed: healCount('failed'),
      healRate: 0.5,
      successRate: 0.4,
      lastRunAt: runs[0]?.createdAt ?? null,
    });
  },
};

const env = {
  REGISTRY: {
    idFromName: () => 'id',
    get: () => registry,
  },
  ARTIFACTS: {},
  AI: {},
  BACKUP_BUCKET: {},
  SANDBOX: {},
  HEALER: {},
  CI_WORKFLOW: {},
  ASSETS: {},
  BACKUP_BUCKET_NAME: 'cloud-ci-backups',
  WATCH_NAMESPACE: 'cloud-ci',
  WATCH_REPO: 'cloud-ci',
};

const handler = new RPCHandler(router);

declare const Bun: {
  serve(options: {
    port: number;
    fetch(request: Request): Promise<Response> | Response;
  }): void;
};

Bun.serve({
  port: 8787,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true });
    }
    const { matched, response } = await handler.handle(request, {
      prefix: '/rpc',
      context: { env: env as unknown as Bindings },
    });
    if (matched) {
      return response;
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

console.log('mock worker listening on http://localhost:8787');
