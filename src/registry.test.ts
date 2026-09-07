import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Bindings } from '../env';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    readonly ctx: unknown;
    readonly env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

import { RunRegistry } from './registry';

function sqlShim(db: DatabaseSync) {
  return {
    exec(query: string, ...params: unknown[]) {
      const keyword = query.trimStart().slice(0, 6).toUpperCase();
      if (keyword === 'SELECT' || keyword === 'PRAGMA' || keyword.startsWith('WITH')) {
        const stmt = db.prepare(query);
        return {
          one: () => stmt.get(...(params as never[])) ?? {},
          toArray: () => stmt.all(...(params as never[])),
        };
      }
      if (params.length === 0) {
        db.exec(query);
      } else {
        db.prepare(query).run(...(params as never[]));
      }
      return { one: () => ({}), toArray: () => [] };
    },
  };
}

function makeRegistry() {
  const db = new DatabaseSync(':memory:');
  const ctx = fromPartial<DurableObjectState>({
    blockConcurrencyWhile: (callback: () => Promise<unknown>) => {
      void callback();
    },
    storage: fromPartial<NonNullable<DurableObjectState['storage']>>({
      sql: sqlShim(db),
    } as never),
  });
  return new RunRegistry(ctx, fromPartial<Bindings>({}));
}

const RUN = {
  id: 'run-1',
  owner: 'newkub',
  repo: 'cloud-ci',
  ref: 'refs/heads/main',
  branch: 'main',
  sha: 'abc123',
  trigger: 'push',
  actor: 'veerapong',
  message: 'feat: test',
};

describe('RunRegistry', () => {
  let registry: RunRegistry;

  beforeEach(() => {
    registry = makeRegistry();
  });

  it('records a run start and reads it back', () => {
    registry.recordRunStart(RUN);

    const run = registry.getRun({ id: 'run-1' });
    expect(run).toMatchObject({
      id: 'run-1',
      repo: 'cloud-ci',
      status: 'running',
      failures: [],
      heal: null,
    });
    expect(run?.createdAt).toBeTypeOf('number');
  });

  it('returns null for unknown runs and heals', () => {
    expect(registry.getRun({ id: 'nope' })).toBeNull();
    expect(registry.getHeal({ runId: 'nope' })).toBeNull();
  });

  it('records run finish with failures and final status', () => {
    registry.recordRunStart(RUN);
    registry.recordRunFinish({
      id: 'run-1',
      status: 'failed',
      failures: [
        {
          runner: { name: 'test', command: 'bun run test' },
          output: 'assertion failed',
        },
      ],
    });

    const run = registry.getRun({ id: 'run-1' });
    expect(run?.status).toBe('failed');
    expect(run?.failures).toHaveLength(1);
    expect(run?.failures[0]?.runner.command).toBe('bun run test');
    expect(run?.finishedAt).toBeTypeOf('number');
  });

  it('lists runs with status filter and pagination', () => {
    registry.recordRunStart(RUN);
    registry.recordRunStart({ ...RUN, id: 'run-2', branch: 'feat/x' });
    registry.recordRunFinish({ id: 'run-2', status: 'success' });

    const all = registry.listRuns({});
    expect(all.total).toBe(2);
    expect(all.items).toHaveLength(2);

    const failed = registry.listRuns({ status: 'running' });
    expect(failed.total).toBe(1);
    expect(failed.items[0]?.id).toBe('run-1');

    const page = registry.listRuns({ limit: 1, offset: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });

  it('tracks heal lifecycle and updates run status', () => {
    registry.recordRunStart(RUN);
    registry.recordHealStart({ runId: 'run-1' });
    expect(registry.getRun({ id: 'run-1' })?.status).toBe('healing');

    registry.recordHealProgress({ runId: 'run-1', steps: 7 });
    expect(registry.getHeal({ runId: 'run-1' })?.steps).toBe(7);

    registry.recordHealFinish({
      runId: 'run-1',
      status: 'pushed',
      steps: 9,
      branch: 'ci-autofix/run-1',
      commit: 'def456',
      prUrl: 'https://github.com/newkub/cloud-ci/pull/3',
      prNumber: 3,
    });

    const heal = registry.getHeal({ runId: 'run-1' });
    expect(heal).toMatchObject({
      status: 'pushed',
      steps: 9,
      branch: 'ci-autofix/run-1',
      prUrl: 'https://github.com/newkub/cloud-ci/pull/3',
      prNumber: 3,
    });
    expect(registry.getRun({ id: 'run-1' })?.status).toBe('healed');
  });

  it('marks run heal_failed when healing fails', () => {
    registry.recordRunStart(RUN);
    registry.recordHealStart({ runId: 'run-1' });
    registry.recordHealFinish({
      runId: 'run-1',
      status: 'failed',
      steps: 25,
      error: 'max steps reached',
    });

    expect(registry.getRun({ id: 'run-1' })?.status).toBe('heal_failed');
    expect(registry.getHeal({ runId: 'run-1' })?.error).toBe(
      'max steps reached'
    );
  });

  it('aggregates stats across runs and heals', () => {
    registry.recordRunStart(RUN);
    registry.recordRunStart({ ...RUN, id: 'run-2' });
    registry.recordRunFinish({ id: 'run-2', status: 'success' });
    registry.recordRunStart({ ...RUN, id: 'run-3' });
    registry.recordHealStart({ runId: 'run-3' });
    registry.recordHealFinish({ runId: 'run-3', status: 'pushed', steps: 4 });

    const stats = registry.stats();
    expect(stats).toMatchObject({
      totalRuns: 3,
      running: 1,
      succeeded: 1,
      healed: 1,
      totalHeals: 1,
      healsPushed: 1,
      healRate: 1,
      successRate: 1,
    });
    expect(stats.lastRunAt).toBeTypeOf('number');
  });

  it('restarting a run resets its record', () => {
    registry.recordRunStart(RUN);
    registry.recordRunFinish({ id: 'run-1', status: 'failed' });
    registry.recordRunStart(RUN);

    const run = registry.getRun({ id: 'run-1' });
    expect(run?.status).toBe('running');
    expect(run?.finishedAt).toBeNull();
  });
});
