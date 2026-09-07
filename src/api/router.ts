import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';
import type { Bindings } from '../../env';
import type { RunRegistry } from '../registry';

const REGISTRY_NAME = 'global';

const base = os.$context<{ env: Bindings }>();

function registry(env: Bindings) {
  return env.REGISTRY.get(
    env.REGISTRY.idFromName(REGISTRY_NAME)
  ) as DurableObjectStub<RunRegistry>;
}

const runStatusSchema = z.enum([
  'running',
  'success',
  'failed',
  'healing',
  'healed',
  'heal_failed',
]);
const healStatusSchema = z.enum(['running', 'pushed', 'failed']);

const health = base.handler(async ({ context }) => {
  const missing: string[] = [];
  const env = context.env as unknown as Record<string, unknown>;
  for (const binding of [
    'ARTIFACTS',
    'AI',
    'BACKUP_BUCKET',
    'SANDBOX',
    'HEALER',
    'REGISTRY',
    'CI_WORKFLOW',
    'ASSETS',
  ]) {
    if (env[binding] === undefined) {
      missing.push(binding);
    }
  }
  return {
    ok: missing.length === 0,
    name: 'cloud-ci',
    bindings: missing.length === 0 ? 'ready' : `missing: ${missing.join(', ')}`,
    time: Date.now(),
  };
});

const stats = base.handler(({ context }) => registry(context.env).stats());

const listRuns = base
  .input(
    z
      .object({
        status: runStatusSchema.optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .optional()
  )
  .handler(({ input, context }) => registry(context.env).listRuns(input ?? {}));

const getRun = base
  .input(z.object({ id: z.string().min(1).max(200) }))
  .handler(({ input, context }) => {
    const run = registry(context.env).getRun({ id: input.id });
    if (!run) {
      throw new ORPCError('NOT_FOUND', { message: `Run ${input.id} not found` });
    }
    return run;
  });

const listHeals = base
  .input(
    z
      .object({
        status: healStatusSchema.optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .optional()
  )
  .handler(({ input, context }) => registry(context.env).listHeals(input ?? {}));

const getHeal = base
  .input(z.object({ runId: z.string().min(1).max(200) }))
  .handler(({ input, context }) => {
    const heal = registry(context.env).getHeal({ runId: input.runId });
    if (!heal) {
      throw new ORPCError('NOT_FOUND', {
        message: `Heal attempt for run ${input.runId} not found`,
      });
    }
    return heal;
  });

const watchConfig = base.handler(({ context }) => {
  const env = context.env as unknown as Record<string, unknown>;
  return {
    namespace: (env.WATCH_NAMESPACE as string | undefined) ?? 'cloud-ci',
    repo: (env.WATCH_REPO as string | undefined) ?? 'cloud-ci',
    backupBucket:
      (env.BACKUP_BUCKET_NAME as string | undefined) ?? 'cloud-ci-backups',
    model: '@cf/moonshotai/kimi-k2.7-code',
  };
});

export const router = base.router({
  health,
  stats,
  watch: { config: watchConfig },
  runs: { list: listRuns, get: getRun },
  heals: { list: listHeals, get: getHeal },
});

export type AppRouter = typeof router;
