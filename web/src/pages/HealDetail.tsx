import { createQuery } from '@tanstack/solid-query';
import { Link, useParams } from '@tanstack/solid-router';
import { Show } from 'solid-js';
import { orpc } from '../api';
import { fmtDuration, fmtTime, shortSha, timeAgo } from '../format';
import {
  Card,
  ErrorState,
  HealBadge,
  Loading,
  LogBlock,
  MetaRow,
} from '../ui';

export function HealDetail() {
  const params = useParams({ from: '/heals/$runId' });
  const runId = () => params().runId;

  const heal = createQuery(() => ({
    queryKey: ['heals', 'detail', runId()],
    queryFn: () => orpc.heals.get({ runId: runId() }),
    retry: 0,
  }));
  const run = createQuery(() => ({
    queryKey: ['runs', 'detail', runId()],
    queryFn: () => orpc.runs.get({ id: runId() }),
    retry: 0,
  }));

  return (
    <div>
      <Link
        to="/heals"
        class="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
      >
        <span class="i-mdi:arrow-left" /> Back to heals
      </Link>

      <Show
        when={heal.data}
        fallback={
          <Show when={heal.isPending} fallback={<ErrorState message="Heal attempt not found." />}>
            <Loading />
          </Show>
        }
      >
        {(h) => (
          <div>
            <div class="flex flex-wrap items-center gap-3 mb-6">
              <h1 class="text-xl font-semibold text-zinc-100">Heal attempt</h1>
              <HealBadge status={h().status} />
              <Show when={h().status === 'running'}>
                <span class="text-xs text-amber-300 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  agent is working — {h().steps} steps so far
                </span>
              </Show>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <h2 class="font-medium text-zinc-200 mb-3">Attempt</h2>
                <MetaRow label="Run">
                  <Link
                    to="/runs/$runId"
                    params={{ runId: h().runId }}
                    class="font-mono text-brand-dim hover:text-brand"
                  >
                    {h().runId}
                  </Link>
                </MetaRow>
                <MetaRow label="Steps">{h().steps}</MetaRow>
                <MetaRow label="Started">
                  {fmtTime(h().startedAt)} ({timeAgo(h().startedAt)})
                </MetaRow>
                <MetaRow label="Duration">
                  {fmtDuration(h().startedAt, h().finishedAt)}
                </MetaRow>
                <Show when={h().branch}>
                  <MetaRow label="Fix branch">
                    <span class="font-mono">{h().branch}</span>
                  </MetaRow>
                </Show>
                <Show when={h().commit}>
                  <MetaRow label="Fix commit">
                    <span class="font-mono">{shortSha(h().commit)}</span>
                  </MetaRow>
                </Show>
                <Show when={h().prUrl}>
                  <MetaRow label="Pull request">
                    <a
                      href={h().prUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      class="inline-flex items-center gap-1.5 text-violet-300 hover:text-violet-200"
                    >
                      <span class="i-mdi:source-pull" />
                      {h().prNumber ? `PR #${h().prNumber}` : h().prUrl}
                      <span class="i-mdi:open-in-new text-xs" />
                    </a>
                  </MetaRow>
                </Show>
              </Card>

              <Card>
                <h2 class="font-medium text-zinc-200 mb-3">Source run</h2>
                <Show
                  when={run.data}
                  fallback={<p class="text-sm text-zinc-500">Loading…</p>}
                >
                  {(r) => (
                    <div>
                      <MetaRow label="Repository">
                        <span class="font-mono">
                          {r().owner}/{r().repo}
                        </span>
                      </MetaRow>
                      <MetaRow label="Commit">
                        <span class="font-mono">{shortSha(r().sha)}</span>
                      </MetaRow>
                      <MetaRow label="Branch">{r().branch ?? '—'}</MetaRow>
                      <MetaRow label="Failed commands">
                        {r().failures.length}
                      </MetaRow>
                    </div>
                  )}
                </Show>
              </Card>
            </div>

            <Show when={h().error}>
              <Card class="mt-4 border-rose-500/30">
                <h2 class="font-medium text-rose-300 mb-2 flex items-center gap-2">
                  <span class="i-mdi:alert-octagon" /> Heal error
                </h2>
                <LogBlock text={h().error ?? ''} />
              </Card>
            </Show>

            <Show when={(run.data?.failures.length ?? 0) > 0}>
              <Card class="mt-4">
                <h2 class="font-medium text-zinc-200 mb-3">
                  Original failures ({run.data?.failures.length})
                </h2>
                <div class="space-y-3">
                  {(run.data?.failures ?? []).map((failure) => (
                    <details class="group border border-line rounded-lg overflow-hidden">
                      <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-surface-2 transition-colors">
                        <span class="i-mdi:close-circle text-rose-400" />
                        <span class="font-mono text-sm text-zinc-200 flex-1 truncate">
                          {failure.runner.command}
                        </span>
                        <span class="i-mdi:chevron-down text-zinc-500 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div class="px-4 pb-3">
                        <LogBlock text={failure.output} />
                      </div>
                    </details>
                  ))}
                </div>
              </Card>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
