import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import { Link } from '@tanstack/solid-router';
import { createSignal, For, Show } from 'solid-js';
import { orpc, type RunRecord } from '../api';
import { fmtDuration, shortSha, timeAgo } from '../format';
import { Card, EmptyState, Loading, PageHeader, StatusBadge } from '../ui';

const FILTERS: { id: RunRecord['status'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'success', label: 'Success' },
  { id: 'failed', label: 'Failed' },
  { id: 'healing', label: 'Healing' },
  { id: 'healed', label: 'Healed' },
  { id: 'heal_failed', label: 'Heal failed' },
];

const PAGE_SIZE = 25;

export function Runs() {
  const [status, setStatus] = createSignal<(typeof FILTERS)[number]['id']>('all');
  const [offset, setOffset] = createSignal(0);

  const query = createQuery(() => {
    const filter = status();
    return {
      queryKey: ['runs', 'list', filter, offset()],
      queryFn: () =>
        orpc.runs.list({
          ...(filter === 'all' ? {} : { status: filter }),
          limit: PAGE_SIZE,
          offset: offset(),
        }),
      placeholderData: keepPreviousData,
    };
  });

  const total = () => query.data?.total ?? 0;
  const canPrev = () => offset() > 0;
  const canNext = () => offset() + PAGE_SIZE < total();

  return (
    <div>
      <PageHeader title="Runs" subtitle="Pipeline runs triggered by pushes" />

      <div class="flex flex-wrap gap-2 mb-4">
        <For each={FILTERS}>
          {(filter) => (
            <button
              type="button"
              aria-pressed={status() === filter.id}
              class={`input-chip ${status() === filter.id ? '!bg-brand/20 !border-brand/50 text-brand-dim' : 'text-zinc-400'}`}
              onClick={() => {
                setStatus(filter.id);
                setOffset(0);
              }}
            >
              {filter.label}
            </button>
          )}
        </For>
      </div>

      <Card class="!p-0 overflow-hidden">
        <Show when={!query.isPending} fallback={<Loading />}>
          <Show
            when={(query.data?.items.length ?? 0) > 0}
            fallback={
              <EmptyState
                icon="i-mdi:pipe-disconnected"
                title="No runs found"
                hint="Try a different filter, or push to the watched repository."
              />
            }
          >
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-line">
                    <th class="px-5 py-3 font-medium">Status</th>
                    <th class="px-5 py-3 font-medium">Commit</th>
                    <th class="px-5 py-3 font-medium">Branch</th>
                    <th class="px-5 py-3 font-medium">Trigger</th>
                    <th class="px-5 py-3 font-medium">Actor</th>
                    <th class="px-5 py-3 font-medium">Duration</th>
                    <th class="px-5 py-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line">
                  <For each={query.data?.items}>
                    {(run) => (
                      <tr class="hover:bg-surface-2/60 transition-colors">
                        <td class="px-5 py-3">
                          <Link
                            to="/runs/$runId"
                            params={{ runId: run.id }}
                          >
                            <StatusBadge status={run.status} />
                          </Link>
                        </td>
                        <td class="px-5 py-3">
                          <Link
                            to="/runs/$runId"
                            params={{ runId: run.id }}
                            class="block max-w-64"
                          >
                            <div class="text-zinc-200 truncate">
                              {run.message ?? '—'}
                            </div>
                            <div class="text-xs text-zinc-500 font-mono">
                              {shortSha(run.sha)}
                            </div>
                          </Link>
                        </td>
                        <td class="px-5 py-3 text-zinc-400 font-mono text-xs">
                          {run.branch ?? '—'}
                        </td>
                        <td class="px-5 py-3 text-zinc-400">{run.trigger}</td>
                        <td class="px-5 py-3 text-zinc-400">
                          {run.actor ?? '—'}
                        </td>
                        <td class="px-5 py-3 text-zinc-400">
                          {fmtDuration(run.createdAt, run.finishedAt)}
                        </td>
                        <td class="px-5 py-3 text-zinc-500 whitespace-nowrap">
                          {timeAgo(run.createdAt)}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </Show>
      </Card>

      <Show when={total() > PAGE_SIZE}>
        <div class="flex items-center justify-between mt-4 text-sm">
          <span class="text-zinc-500">
            {offset() + 1}–{Math.min(offset() + PAGE_SIZE, total())} of {total()}
          </span>
          <div class="flex gap-2">
            <button
              class="input-chip text-zinc-300 disabled:opacity-40"
              disabled={!canPrev()}
              onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
            >
              ← Prev
            </button>
            <button
              class="input-chip text-zinc-300 disabled:opacity-40"
              disabled={!canNext()}
              onClick={() => setOffset((v) => v + PAGE_SIZE)}
            >
              Next →
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
