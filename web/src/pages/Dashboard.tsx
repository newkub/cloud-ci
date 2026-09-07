import { createQuery } from '@tanstack/solid-query';
import { Link } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';
import { orpc } from '../api';
import { fmtDuration, fmtPercent, shortSha, timeAgo } from '../format';
import { Card, EmptyState, Loading, PageHeader, StatCard, StatusBadge } from '../ui';

export function Dashboard() {
  const stats = createQuery(() => ({
    queryKey: ['stats'],
    queryFn: () => orpc.stats(),
  }));
  const runs = createQuery(() => ({
    queryKey: ['runs', 'recent'],
    queryFn: () => orpc.runs.list({ limit: 8 }),
  }));
  const heals = createQuery(() => ({
    queryKey: ['heals', 'recent'],
    queryFn: () => orpc.heals.list({ limit: 8 }),
  }));
  const config = createQuery(() => ({
    queryKey: ['config'],
    queryFn: () => orpc.watch.config(),
    staleTime: 60_000,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Self-healing CI pipeline overview"
      />

      <Show when={stats.data} fallback={<Loading />}>
        {(s) => (
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total runs"
              value={s().totalRuns}
              icon="i-mdi:pipe"
              hint={
                s().running > 0 ? `${s().running} running now` : 'No active runs'
              }
              accent="sky"
            />
            <StatCard
              label="Success rate"
              value={fmtPercent(s().successRate)}
              icon="i-mdi:check-decagram"
              hint={`${s().succeeded} passed, ${s().failed} failed`}
              accent="emerald"
            />
            <StatCard
              label="Heal rate"
              value={fmtPercent(s().healRate)}
              icon="i-mdi:auto-fix"
              hint={`${s().healsPushed} fixes pushed of ${s().healsPushed + s().healsFailed} attempts`}
              accent="violet"
            />
            <StatCard
              label="Healing now"
              value={s().healsRunning}
              icon="i-mdi:bandage"
              hint={
                s().healsRunning > 0
                  ? 'Agent is working'
                  : `Last run ${timeAgo(s().lastRunAt)}`
              }
              accent="brand"
            />
          </div>
        )}
      </Show>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-6">
        <Card>
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-medium text-zinc-200">Recent runs</h2>
            <Link
              to="/runs"
              class="text-sm text-brand-dim hover:text-brand transition-colors"
            >
              View all →
            </Link>
          </div>
          <Show when={!runs.isPending} fallback={<Loading />}>
            <Show
              when={(runs.data?.items.length ?? 0) > 0}
              fallback={
                <EmptyState
                  icon="i-mdi:pipe-disconnected"
                  title="No runs yet"
                  hint="Pushes to the watched repository will appear here."
                />
              }
            >
              <div class="divide-y divide-line -mx-5 px-5">
                <For each={runs.data?.items}>
                  {(run) => (
                    <Link
                      to="/runs/$runId"
                      params={{ runId: run.id }}
                      class="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <StatusBadge status={run.status} />
                      <div class="min-w-0 flex-1">
                        <div class="text-sm text-zinc-200 truncate">
                          {run.message ?? run.repo}
                        </div>
                        <div class="text-xs text-zinc-500 font-mono">
                          {run.repo}#{shortSha(run.sha)}
                          {run.branch ? ` · ${run.branch}` : ''}
                        </div>
                      </div>
                      <div class="text-xs text-zinc-500 shrink-0">
                        {fmtDuration(run.createdAt, run.finishedAt)}
                      </div>
                    </Link>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Card>

        <Card>
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-medium text-zinc-200">Recent heal attempts</h2>
            <Link
              to="/heals"
              class="text-sm text-brand-dim hover:text-brand transition-colors"
            >
              View all →
            </Link>
          </div>
          <Show when={!heals.isPending} fallback={<Loading />}>
            <Show
              when={(heals.data?.items.length ?? 0) > 0}
              fallback={
                <EmptyState
                  icon="i-mdi:robot-happy-outline"
                  title="No heal attempts"
                  hint="When a run fails, the agent tries to fix it and pushes a fix branch."
                />
              }
            >
              <div class="divide-y divide-line -mx-5 px-5">
                <For each={heals.data?.items}>
                  {(heal) => (
                    <Link
                      to="/heals/$runId"
                      params={{ runId: heal.runId }}
                      class="flex items-center gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <Show
                        when={heal.status === 'pushed'}
                        fallback={
                          <span
                            class={`w-2 h-2 rounded-full shrink-0 ${heal.status === 'running' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}`}
                          />
                        }
                      >
                        <span class="i-mdi:source-pull text-violet-300 shrink-0" />
                      </Show>
                      <div class="min-w-0 flex-1">
                        <div class="text-sm text-zinc-200 font-mono truncate">
                          {heal.branch ?? heal.runId}
                        </div>
                        <div class="text-xs text-zinc-500">
                          {heal.steps} steps · {timeAgo(heal.startedAt)}
                        </div>
                      </div>
                      <Show when={heal.prUrl}>
                        <span class="i-mdi:open-in-new text-zinc-500 shrink-0" />
                      </Show>
                    </Link>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Card>
      </div>

      <Show when={config.data}>
        {(c) => (
          <Card class="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div class="flex items-center gap-2 text-zinc-400">
              <span class="i-mdi:eye-outline text-lg" />
              Watching
              <span class="font-mono text-zinc-200">
                {c().namespace}/{c().repo}
              </span>
            </div>
            <div class="flex items-center gap-2 text-zinc-400">
              <span class="i-mdi:robot-outline text-lg" />
              Model
              <span class="font-mono text-zinc-200">{c().model}</span>
            </div>
            <div class="flex items-center gap-2 text-zinc-400">
              <span class="i-mdi:bucket-outline text-lg" />
              Backups
              <span class="font-mono text-zinc-200">{c().backupBucket}</span>
            </div>
          </Card>
        )}
      </Show>
    </div>
  );
}
