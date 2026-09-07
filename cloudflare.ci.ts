import { CIWorkflow, isCiRunnerFailure } from '@cloudflare/ci';
import type {
  CiContext,
  CiParams,
  CiRunnerResult,
  CloudflareArtifacts,
} from '@cloudflare/ci';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { getAgentByName } from 'agents';
import type { Bindings } from './env';
import { CiRunFailedWithFix, enrichFailure } from './src/healing/failures';
import { HealingAgent } from './src/healing/healer';
import type { RunRegistry } from './src/registry';
import type { RunFailure, RunStatus } from './src/registry';

const REGISTRY_NAME = 'global';
const REGISTRY_STEP_CONFIG = {
  retries: { limit: 2, delay: 1_000 },
  timeout: 30_000,
} as const;

export class Healer extends HealingAgent {
  getModel() {
    return '@cf/moonshotai/kimi-k2.7-code';
  }
}

export class CI extends CIWorkflow<CloudflareArtifacts, Bindings> {
  private registry() {
    return this.env.REGISTRY.get(
      this.env.REGISTRY.idFromName(REGISTRY_NAME)
    ) as DurableObjectStub<RunRegistry>;
  }

  private recordRunStart(
    event: WorkflowEvent<CiParams<CloudflareArtifacts>>,
    step: WorkflowStep
  ) {
    const payload = event.payload;
    return step.do('record-run-start', REGISTRY_STEP_CONFIG, () =>
      this.registry().recordRunStart({
        id: event.instanceId,
        owner: payload.owner,
        repo: payload.repo,
        ref: payload.ref,
        ...(payload.branch === undefined
          ? {}
          : { branch: payload.branch }),
        sha: payload.sha,
        trigger: payload.trigger,
        ...(payload.actor === undefined ? {} : { actor: payload.actor }),
        ...(payload.headCommitMessage === undefined
          ? {}
          : { message: payload.headCommitMessage }),
      })
    );
  }

  private recordRunFinish(
    step: WorkflowStep,
    name: string,
    runId: string,
    status: RunStatus,
    failures?: RunFailure[],
    error?: string
  ) {
    return step.do(name, REGISTRY_STEP_CONFIG, () =>
      this.registry().recordRunFinish({
        id: runId,
        status,
        ...(failures === undefined ? {} : { failures }),
        ...(error === undefined ? {} : { error }),
      })
    );
  }

  protected async pipeline(
    event: WorkflowEvent<CiParams<CloudflareArtifacts>>,
    step: WorkflowStep,
    ci: CiContext
  ): Promise<void> {
    const runId = event.instanceId;
    await this.recordRunStart(event, step);

    let deps: CiRunnerResult;
    try {
      deps = await ci.runner({
        name: 'install',
        command: 'bun install --frozen-lockfile',
        cache: { inputs: ['package.json', 'bun.lock'] },
      });

      await Promise.all([
        deps.runner({ name: 'lint', command: 'bun run lint' }),
        deps.runner({ name: 'test', command: 'bun run test' }),
        deps.runner({ name: 'typecheck', command: 'bun run typecheck' }),
        deps.runner({ name: 'build', command: 'bun run build' }),
      ]);
    } catch (failure) {
      if (!isCiRunnerFailure(failure)) {
        await this.recordRunFinish(
          step,
          'record-run-failed',
          runId,
          'failed',
          undefined,
          failure instanceof Error ? failure.message : String(failure)
        );
        throw failure;
      }
      const baseBranch = event.payload.branch;
      if (!baseBranch) {
        await this.recordRunFinish(
          step,
          'record-run-failed',
          runId,
          'failed',
          failure.diagnostics.failures
        );
        throw new Error('Cannot heal a run without a base branch');
      }

      let healed: { branch: string; commit: string; steps: number };
      try {
        healed = await step.do(
          'heal',
          { retries: { limit: 0, delay: 0 }, timeout: '5 hours' },
          async () => {
            const healer = await getAgentByName(
              this.env.HEALER,
              event.instanceId
            );
            using result = await healer.heal({
              failure: enrichFailure({ failure, event, baseBranch }),
              prompt: 'Fix every observed failure without weakening validation.',
            });
            const { branch, commit, steps } = result;
            return { branch, commit, steps };
          }
        );
      } catch (healError) {
        await this.recordRunFinish(
          step,
          'record-run-heal-failed',
          runId,
          'heal_failed',
          failure.diagnostics.failures,
          healError instanceof Error ? healError.message : String(healError)
        );
        throw healError;
      }

      await this.recordRunFinish(
        step,
        'record-run-healed',
        runId,
        'healed',
        failure.diagnostics.failures
      );

      throw new CiRunFailedWithFix(failure, healed);
    }

    await deps.runner({
      name: 'deploy',
      command: 'bunx wrangler deploy',
      cloudflareCredentials: {
        accountId: this.env.CLOUDFLARE_DEPLOY_ACCOUNT_ID,
      },
    });

    await this.recordRunFinish(step, 'record-run-success', runId, 'success');
  }
}
