import { createQuery } from '@tanstack/solid-query';
import { For, Show } from 'solid-js';
import { orpc } from '../api';
import { fmtTime } from '../format';
import { Card, Loading, MetaRow, PageHeader } from '../ui';

export function Config() {
  const health = createQuery(() => ({
    queryKey: ['health'],
    queryFn: () => orpc.health(),
  }));
  const config = createQuery(() => ({
    queryKey: ['config'],
    queryFn: () => orpc.watch.config(),
  }));

  const bindingRows = () => [
    { label: 'Artifacts', name: 'ARTIFACTS', icon: 'i-mdi:package-variant' },
    { label: 'Workers AI', name: 'AI', icon: 'i-mdi:robot-outline' },
    { label: 'R2 backups', name: 'BACKUP_BUCKET', icon: 'i-mdi:bucket-outline' },
    { label: 'CI sandbox', name: 'SANDBOX', icon: 'i-mdi:cube-outline' },
    { label: 'Healer agent', name: 'HEALER', icon: 'i-mdi:bandage' },
    { label: 'Run registry', name: 'REGISTRY', icon: 'i-mdi:database-outline' },
    { label: 'CI workflow', name: 'CI_WORKFLOW', icon: 'i-mdi:pipe' },
    { label: 'Static assets', name: 'ASSETS', icon: 'i-mdi:web' },
  ];

  return (
    <div>
      <PageHeader title="Configuration" subtitle="Watched repository and worker bindings" />

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <h2 class="font-medium text-zinc-200 mb-3">Pipeline</h2>
          <Show when={config.data} fallback={<Loading />}>
            {(c) => (
              <div>
                <MetaRow label="Namespace">
                  <span class="font-mono">{c().namespace}</span>
                </MetaRow>
                <MetaRow label="Repository">
                  <span class="font-mono">{c().repo}</span>
                </MetaRow>
                <MetaRow label="Backup bucket">
                  <span class="font-mono">{c().backupBucket}</span>
                </MetaRow>
                <MetaRow label="Healer model">
                  <span class="font-mono">{c().model}</span>
                </MetaRow>
              </div>
            )}
          </Show>
        </Card>

        <Card>
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-medium text-zinc-200">Worker status</h2>
            <Show when={health.data}>
              {(h) => (
                <span
                  class={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
                    h().ok
                      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                      : 'text-rose-300 bg-rose-500/15 border-rose-500/30'
                  }`}
                >
                  <span
                    class={`w-1.5 h-1.5 rounded-full ${h().ok ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  />
                  {h().ok ? 'healthy' : 'degraded'}
                </span>
              )}
            </Show>
          </div>
          <div class="space-y-1">
            <For each={bindingRows()}>
              {(row) => (
                <div class="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <span class="flex items-center gap-2.5 text-sm text-zinc-300">
                    <span class={`${row.icon} text-zinc-500`} />
                    {row.label}
                  </span>
                  <span class="font-mono text-xs text-zinc-500">{row.name}</span>
                </div>
              )}
            </For>
          </div>
          <Show when={health.data && !health.data!.ok}>
            <p class="mt-3 text-xs text-rose-300">
              {health.data?.bindings}
            </p>
          </Show>
          <Show when={health.data}>
            <p class="mt-3 text-xs text-zinc-600">
              Checked {fmtTime(health.data?.time)}
            </p>
          </Show>
        </Card>
      </div>

      <Card class="mt-4">
        <h2 class="font-medium text-zinc-200 mb-2">How it works</h2>
        <ol class="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
          <li>A push to the watched Artifacts repository triggers the CI workflow.</li>
          <li>The pipeline runs install → lint, test, typecheck, build in a Sandbox.</li>
          <li>On failure, the Healing Agent opens a sandbox, fixes the code, and re-verifies every failed command.</li>
          <li>A verified fix is pushed to a <code class="font-mono text-zinc-300">ci-autofix/&lt;run-id&gt;</code> branch and a pull request is opened.</li>
        </ol>
      </Card>
    </div>
  );
}
