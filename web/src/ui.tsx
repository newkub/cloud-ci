import type { JSX, ParentProps } from 'solid-js';
import { Show } from 'solid-js';
import type { HealRecord, RunRecord } from './api';

const RUN_STATUS: Record<
  RunRecord['status'],
  { label: string; icon: string; cls: string }
> = {
  running: {
    label: 'Running',
    icon: 'i-mdi:progress-clock',
    cls: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
  },
  success: {
    label: 'Success',
    icon: 'i-mdi:check-circle',
    cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  },
  failed: {
    label: 'Failed',
    icon: 'i-mdi:close-circle',
    cls: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
  },
  healing: {
    label: 'Healing',
    icon: 'i-mdi:bandage',
    cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  },
  healed: {
    label: 'Healed',
    icon: 'i-mdi:auto-fix',
    cls: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
  },
  heal_failed: {
    label: 'Heal failed',
    icon: 'i-mdi:alert-octagon',
    cls: 'text-orange-300 bg-orange-500/15 border-orange-500/30',
  },
};

const HEAL_STATUS: Record<
  HealRecord['status'],
  { label: string; icon: string; cls: string }
> = {
  running: {
    label: 'Healing',
    icon: 'i-mdi:bandage',
    cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  },
  pushed: {
    label: 'Fix pushed',
    icon: 'i-mdi:source-pull',
    cls: 'text-violet-300 bg-violet-500/15 border-violet-500/30',
  },
  failed: {
    label: 'Failed',
    icon: 'i-mdi:close-circle',
    cls: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
  },
};

export function StatusBadge(props: { status: RunRecord['status'] }) {
  const meta = () => RUN_STATUS[props.status];
  return (
    <span
      class={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${meta().cls}`}
    >
      <span class={meta().icon} />
      {meta().label}
    </span>
  );
}

export function HealBadge(props: { status: HealRecord['status'] }) {
  const meta = () => HEAL_STATUS[props.status];
  return (
    <span
      class={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${meta().cls}`}
    >
      <span class={meta().icon} />
      {meta().label}
    </span>
  );
}

export function Card(props: ParentProps<{ class?: string }>) {
  return (
    <div class={`card p-5 ${props.class ?? ''}`}>{props.children}</div>
  );
}

export function StatCard(props: {
  label: string;
  value: JSX.Element | string | number;
  icon: string;
  hint?: string;
  accent?: 'brand' | 'emerald' | 'violet' | 'rose' | 'sky';
}) {
  const accent = () => props.accent ?? 'brand';
  const iconCls = () =>
    ({
      brand: 'bg-brand/15 text-brand-dim',
      emerald: 'bg-emerald-500/15 text-emerald-300',
      violet: 'bg-violet-500/15 text-violet-300',
      rose: 'bg-rose-500/15 text-rose-300',
      sky: 'bg-sky-500/15 text-sky-300',
    })[accent()];
  return (
    <Card class="flex items-start gap-4">
      <div
        class={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${iconCls()}`}
      >
        <span class={`${props.icon} text-xl`} />
      </div>
      <div class="min-w-0">
        <div class="text-sm text-zinc-400">{props.label}</div>
        <div class="text-2xl font-semibold text-zinc-100 truncate">
          {props.value}
        </div>
        <Show when={props.hint}>
          <div class="text-xs text-zinc-500 mt-0.5">{props.hint}</div>
        </Show>
      </div>
    </Card>
  );
}

export function PageHeader(props: { title: string; subtitle?: string }) {
  return (
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-zinc-100">{props.title}</h1>
      <Show when={props.subtitle}>
        <p class="text-sm text-zinc-500 mt-1">{props.subtitle}</p>
      </Show>
    </div>
  );
}

export function EmptyState(props: { icon: string; title: string; hint?: string }) {
  return (
    <div class="flex flex-col items-center justify-center py-14 text-center">
      <span class={`${props.icon} text-4xl text-zinc-600`} />
      <div class="mt-3 text-zinc-400 font-medium">{props.title}</div>
      <Show when={props.hint}>
        <div class="mt-1 text-sm text-zinc-600 max-w-md">{props.hint}</div>
      </Show>
    </div>
  );
}

export function Loading() {
  return (
    <div class="flex items-center justify-center py-14 text-zinc-500 gap-2">
      <span class="i-mdi:loading animate-spin text-xl" />
      Loading…
    </div>
  );
}

export function ErrorState(props: { message: string }) {
  return (
    <div class="card p-5 border-rose-500/30 bg-rose-500/5 text-rose-300 text-sm flex items-center gap-2">
      <span class="i-mdi:alert-circle text-lg" />
      {props.message}
    </div>
  );
}

export function MetaRow(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-b border-line last:border-0">
      <div class="w-36 shrink-0 text-sm text-zinc-500">{props.label}</div>
      <div class="text-sm text-zinc-200 break-all min-w-0">{props.children}</div>
    </div>
  );
}

export function LogBlock(props: { text: string }) {
  return (
    <pre class="mt-2 p-3 rounded-lg bg-surface-0 border border-line text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-72 overflow-y-auto font-mono">
      {props.text}
    </pre>
  );
}
