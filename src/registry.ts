import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../env';

export type RunStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'healing'
  | 'healed'
  | 'heal_failed';

export type RunRecord = {
  id: string;
  owner: string;
  repo: string;
  ref: string;
  branch: string | null;
  sha: string;
  trigger: string;
  actor: string | null;
  message: string | null;
  status: RunStatus;
  failures: RunFailure[];
  createdAt: number;
  finishedAt: number | null;
};

export type RunFailure = {
  runner: { name: string; command: string; cwd?: string };
  output: string;
};

export type HealStatus = 'running' | 'pushed' | 'failed';

export type HealRecord = {
  runId: string;
  status: HealStatus;
  steps: number;
  branch: string | null;
  commit: string | null;
  prUrl: string | null;
  prNumber: number | null;
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
};

export type RegistryStats = {
  totalRuns: number;
  running: number;
  succeeded: number;
  failed: number;
  healing: number;
  healed: number;
  healFailed: number;
  totalHeals: number;
  healsPushed: number;
  healsRunning: number;
  healsFailed: number;
  healRate: number;
  successRate: number;
  lastRunAt: number | null;
};

export type RunListInput = {
  status?: RunStatus;
  limit?: number;
  offset?: number;
};

export type HealListInput = {
  status?: HealStatus;
  limit?: number;
  offset?: number;
};

type RunRow = {
  id: string;
  owner: string;
  repo: string;
  ref: string;
  branch: string | null;
  sha: string;
  trigger: string;
  actor: string | null;
  message: string | null;
  status: RunStatus;
  failures: string;
  created_at: number;
  finished_at: number | null;
};

type HealRow = {
  run_id: string;
  status: HealStatus;
  steps: number;
  branch: string | null;
  commit: string | null;
  pr_url: string | null;
  pr_number: number | null;
  error: string | null;
  started_at: number;
  finished_at: number | null;
};

const MAX_LIST_LIMIT = 100;
const OUTPUT_LIMIT = 20_000;

export class RunRegistry extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          owner TEXT NOT NULL,
          repo TEXT NOT NULL,
          ref TEXT NOT NULL,
          branch TEXT,
          sha TEXT NOT NULL,
          trigger TEXT NOT NULL,
          actor TEXT,
          message TEXT,
          status TEXT NOT NULL,
          failures TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          finished_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS runs_created_at ON runs (created_at DESC);
        CREATE TABLE IF NOT EXISTS heals (
          run_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          steps INTEGER NOT NULL DEFAULT 0,
          branch TEXT,
          "commit" TEXT,
          pr_url TEXT,
          pr_number INTEGER,
          error TEXT,
          started_at INTEGER NOT NULL,
          finished_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS heals_started_at ON heals (started_at DESC);
      `);
    });
  }

  recordRunStart(input: {
    id: string;
    owner: string;
    repo: string;
    ref: string;
    branch?: string;
    sha: string;
    trigger: string;
    actor?: string;
    message?: string;
  }): true {
    this.ctx.storage.sql.exec(
      `INSERT INTO runs (id, owner, repo, ref, branch, sha, trigger, actor, message, status, failures, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', '[]', ?)
       ON CONFLICT(id) DO UPDATE SET
         owner = excluded.owner,
         repo = excluded.repo,
         ref = excluded.ref,
         branch = excluded.branch,
         sha = excluded.sha,
         trigger = excluded.trigger,
         actor = excluded.actor,
         message = excluded.message,
         status = 'running',
         failures = '[]',
         created_at = excluded.created_at,
         finished_at = NULL`,
      input.id,
      input.owner,
      input.repo,
      input.ref,
      input.branch ?? null,
      input.sha,
      input.trigger,
      input.actor ?? null,
      input.message ?? null,
      Date.now()
    );
    return true;
  }

  recordRunFinish(input: {
    id: string;
    status: RunStatus;
    failures?: RunFailure[];
    error?: string;
  }): true {
    const failures = JSON.stringify(
      (input.failures ?? []).map((failure) => ({
        runner: failure.runner,
        output: trimOutput(failure.output),
      }))
    );
    this.ctx.storage.sql.exec(
      `UPDATE runs SET status = ?, failures = ?, finished_at = ? WHERE id = ?`,
      input.status,
      failures,
      Date.now(),
      input.id
    );
    if (input.error) {
      this.ctx.storage.sql.exec(
        `UPDATE runs SET message = message || ? WHERE id = ?`,
        `\n[error] ${trimOutput(input.error)}`,
        input.id
      );
    }
    return true;
  }

  recordHealStart(input: { runId: string }): true {
    this.ctx.storage.sql.exec(
      `INSERT INTO heals (run_id, status, steps, started_at)
       VALUES (?, 'running', 0, ?)
       ON CONFLICT(run_id) DO UPDATE SET
         status = 'running',
         steps = 0,
         branch = NULL,
         "commit" = NULL,
         pr_url = NULL,
         pr_number = NULL,
         error = NULL,
         started_at = excluded.started_at,
         finished_at = NULL`,
      input.runId,
      Date.now()
    );
    this.ctx.storage.sql.exec(
      `UPDATE runs SET status = 'healing' WHERE id = ?`,
      input.runId
    );
    return true;
  }

  recordHealProgress(input: { runId: string; steps: number }): true {
    this.ctx.storage.sql.exec(
      `UPDATE heals SET steps = ? WHERE run_id = ? AND status = 'running'`,
      input.steps,
      input.runId
    );
    return true;
  }

  recordHealFinish(input: {
    runId: string;
    status: HealStatus;
    steps: number;
    branch?: string;
    commit?: string;
    prUrl?: string;
    prNumber?: number;
    error?: string;
  }): true {
    this.ctx.storage.sql.exec(
      `UPDATE heals SET
         status = ?, steps = ?, branch = ?, "commit" = ?, pr_url = ?, pr_number = ?, error = ?, finished_at = ?
       WHERE run_id = ?`,
      input.status,
      input.steps,
      input.branch ?? null,
      input.commit ?? null,
      input.prUrl ?? null,
      input.prNumber ?? null,
      input.error ? trimOutput(input.error) : null,
      Date.now(),
      input.runId
    );
    this.ctx.storage.sql.exec(
      `UPDATE runs SET status = ?, finished_at = ? WHERE id = ?`,
      input.status === 'pushed' ? 'healed' : 'heal_failed',
      Date.now(),
      input.runId
    );
    return true;
  }

  listRuns(input: RunListInput = {}): { items: RunRecord[]; total: number } {
    const limit = clamp(input.limit ?? 50, 1, MAX_LIST_LIMIT);
    const offset = Math.max(0, input.offset ?? 0);
    const where = input.status ? `WHERE status = ?` : '';
    const params: unknown[] = input.status ? [input.status] : [];
    const total =
      this.ctx.storage.sql
        .exec(`SELECT COUNT(*) AS count FROM runs ${where}`, ...params)
        .one().count as number;
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT * FROM runs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      )
      .toArray() as unknown as RunRow[];
    return { items: rows.map(toRunRecord), total };
  }

  getRun(input: { id: string }): (RunRecord & { heal: HealRecord | null }) | null {
    const rows = this.ctx.storage.sql
      .exec(`SELECT * FROM runs WHERE id = ?`, input.id)
      .toArray() as unknown as RunRow[];
    const row = rows[0];
    if (!row) {
      return null;
    }
    const heal = this.getHeal({ runId: input.id });
    return { ...toRunRecord(row), heal };
  }

  listHeals(input: HealListInput = {}): { items: HealRecord[]; total: number } {
    const limit = clamp(input.limit ?? 50, 1, MAX_LIST_LIMIT);
    const offset = Math.max(0, input.offset ?? 0);
    const where = input.status ? `WHERE status = ?` : '';
    const params: unknown[] = input.status ? [input.status] : [];
    const total =
      this.ctx.storage.sql
        .exec(`SELECT COUNT(*) AS count FROM heals ${where}`, ...params)
        .one().count as number;
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT * FROM heals ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
        ...params,
        limit,
        offset
      )
      .toArray() as unknown as HealRow[];
    return { items: rows.map(toHealRecord), total };
  }

  getHeal(input: { runId: string }): HealRecord | null {
    const rows = this.ctx.storage.sql
      .exec(`SELECT * FROM heals WHERE run_id = ?`, input.runId)
      .toArray() as unknown as HealRow[];
    const row = rows[0];
    return row ? toHealRecord(row) : null;
  }

  stats(): RegistryStats {
    const counts = this.ctx.storage.sql
      .exec(`SELECT status, COUNT(*) AS count FROM runs GROUP BY status`)
      .toArray() as unknown as { status: RunStatus; count: number }[];
    const byStatus = Object.fromEntries(
      counts.map(({ status, count }) => [status, count])
    );
    const healCounts = this.ctx.storage.sql
      .exec(`SELECT status, COUNT(*) AS count FROM heals GROUP BY status`)
      .toArray() as unknown as { status: HealStatus; count: number }[];
    const healsByStatus = Object.fromEntries(
      healCounts.map(({ status, count }) => [status, count])
    );
    const last = this.ctx.storage.sql
      .exec(`SELECT MAX(created_at) AS latest FROM runs`)
      .one();

    const totalRuns = counts.reduce((sum, { count }) => sum + count, 0);
    const succeeded = byStatus['success'] ?? 0;
    const failed = byStatus['failed'] ?? 0;
    const healing = byStatus['healing'] ?? 0;
    const healed = byStatus['healed'] ?? 0;
    const healFailed = byStatus['heal_failed'] ?? 0;
    const healsPushed = healsByStatus['pushed'] ?? 0;
    const healsFailed = healsByStatus['failed'] ?? 0;
    const healsRunning = healsByStatus['running'] ?? 0;
    const totalHeals = healCounts.reduce((sum, { count }) => sum + count, 0);
    const finishedHeals = healsPushed + healsFailed;
    const finishedRuns = succeeded + failed + healed + healFailed;

    return {
      totalRuns,
      running: byStatus['running'] ?? 0,
      succeeded,
      failed,
      healing,
      healed,
      healFailed,
      totalHeals,
      healsPushed,
      healsRunning,
      healsFailed,
      healRate: finishedHeals > 0 ? healsPushed / finishedHeals : 0,
      successRate: finishedRuns > 0 ? (succeeded + healed) / finishedRuns : 0,
      lastRunAt: (last.latest as number | null) ?? null,
    };
  }
}

function toRunRecord(row: RunRow): RunRecord {
  let failures: RunFailure[] = [];
  try {
    failures = JSON.parse(row.failures) as RunFailure[];
  } catch {
    failures = [];
  }
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    ref: row.ref,
    branch: row.branch,
    sha: row.sha,
    trigger: row.trigger,
    actor: row.actor,
    message: row.message,
    status: row.status,
    failures,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function toHealRecord(row: HealRow): HealRecord {
  return {
    runId: row.run_id,
    status: row.status,
    steps: row.steps,
    branch: row.branch,
    commit: row.commit,
    prUrl: row.pr_url,
    prNumber: row.pr_number,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function trimOutput(output: string) {
  return output.length <= OUTPUT_LIMIT ? output : output.slice(-OUTPUT_LIMIT);
}
