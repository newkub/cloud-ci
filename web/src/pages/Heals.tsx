import { createQuery, keepPreviousData } from '@tanstack/solid-query';
import { Link } from '@tanstack/solid-router';
import { createSignal, For, Show } from 'solid-js';
import { orpc, type HealRecord } from '../api';
import { fmtDuration, timeAgo } from '../format';
import { Card, EmptyState, HealBadge, Loading, PageHeader } from '../ui';

const FILTERS: { id: HealRecord['status'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Healing' },
  { id: 'pushed', label: 'Fix pushed' },
  { id: 'failed', label: 'Failed' },
];

const PAGE_SIZE = 25;

export function Heals() {
  const [status, setStatus] = createSignal<(typeof FILTERS)[number]['id']>('all');
  const [offset, setOffset] = createSignal(0);

  const query = createQuery(() => {
    const filter = status();
    return {
      queryKey: ['heals', 'list', filter, offset()],
      queryFn: () =>
        orpc.heals.list({
          ...(filter === 'all' ? {} : { status: filter }),
          limit: PAGE_SIZE,
          offset: offset(),
        }),
      placeholderData: keepPreviousData,
    };
  });

  const total = () => query.data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Heal attempts"
        subtitle="Automated fixes produced by the healing agent"
      />

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
                icon="i-mdi:robot-happy-outline"
                title="No heal attempts"
                hint="When a run fails, the healing agent automatically tries to produce a fix."
              />
            }
          >
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-wide text-zinc-500 border-b border-line">
                    <th class="px-5 py-3 font-medium">Status</th>
                    <th class="px-5 py-3 font-medium">Run</th>
                    <th class="px-5 py-3 font-medium">Fix branch</th>
                    <th class="px-5 py-3 font-medium">PR</th>
                    <th class="px-5 py-3 font-medium">Steps</th>
                    <th class="px-5 py-3 font-medium">Duration</th>
                    <th class="px-5 py-3 font-medium">Started</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line">
                  <For each={query.data?.items}>
                    {(heal) => (
                      <tr class="hover:bg-surface-2/60 transition-colors">
                        <td class="px-5 py-3">
                          <Link
                            to="/heals/$runId"
                            params={{ runId: heal.runId }}
                          >
                            <HealBadge status={heal.status} />
                          </Link>
                        </td>
                        <td class="px-5 py-3">
                          <Link
                            to="/runs/$runId"
                            params={{ runId: heal.runId }}
                            class="font-mono text-xs text-zinc-400 hover:text-zinc-200"
                          >
                            {heal.runId.slice(0, 12)}…
                          </Link>
                        </td>
                        <td class="px-5 py-3 font-mono text-xs text-zinc-300">
                          {heal.branch ?? '—'}
                        </td>
                        <td class="px-5 py-3">
                          <Show
                            when={heal.prUrl}
                            fallback={<span class="text-zinc-600">—</span>}
                          >
                            <a
                              href={heal.prUrl ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              class="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
                            >
                              <span class="i-mdi:source-pull" />
                              {heal.prNumber ? `#${heal.prNumber}` : 'Open'}
                            </a>
                          </Show>
                        </td>
                        <td class="px-5 py-3 text-zinc-400">{heal.steps}</td>
                        <td class="px-5 py-3 text-zinc-400">
                          {fmtDuration(heal.startedAt, heal.finishedAt)}
                        </td>
                        <td class="px-5 py-3 text-zinc-500 whitespace-nowrap">
                          {timeAgo(heal.startedAt)}
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
              disabled={offset() === 0}
              onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
            >
              ← Prev
            </button>
            <button
              class="input-chip text-zinc-300 disabled:opacity-40"
              disabled={offset() + PAGE_SIZE >= total()}
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
