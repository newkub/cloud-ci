import { createQuery } from '@tanstack/solid-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
} from '@tanstack/solid-router';
import { For, Show } from 'solid-js';
import { orpc } from './api';
import { Config } from './pages/Config';
import { Dashboard } from './pages/Dashboard';
import { HealDetail } from './pages/HealDetail';
import { Heals } from './pages/Heals';
import { RunDetail } from './pages/RunDetail';
import { Runs } from './pages/Runs';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'i-mdi:view-dashboard-outline', exact: true },
  { to: '/runs', label: 'Runs', icon: 'i-mdi:pipe', exact: false },
  { to: '/heals', label: 'Heal attempts', icon: 'i-mdi:auto-fix', exact: false },
  { to: '/config', label: 'Configuration', icon: 'i-mdi:cog-outline', exact: false },
] as const;

function RootLayout() {
  const health = createQuery(() => ({
    queryKey: ['health'],
    queryFn: () => orpc.health(),
  }));

  return (
    <div class="min-h-full flex flex-col">
      <header class="lg:hidden sticky top-0 z-10 border-b border-line bg-surface-1/95 backdrop-blur">
        <div class="flex items-center gap-3 px-4 h-14">
          <div class="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
            <span class="i-mdi:cloud-sync-outline text-brand text-lg" />
          </div>
          <div class="font-semibold text-zinc-100">cloud-ci</div>
        </div>
        <nav class="flex gap-1 px-3 pb-2 overflow-x-auto" aria-label="Main">
          <For each={NAV}>
            {(item) => (
              <Link
                to={item.to}
                activeOptions={{ exact: item.exact }}
                inactiveProps={{
                  class:
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap text-zinc-400 hover:text-zinc-100 hover:bg-surface-2 transition-colors',
                }}
                activeProps={{
                  class:
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap text-brand-dim bg-brand/10 border border-brand/25',
                }}
              >
                <span class={`${item.icon}`} />
                {item.label}
              </Link>
            )}
          </For>
        </nav>
      </header>

      <aside class="hidden lg:flex w-60 shrink-0 border-r border-line bg-surface-1 flex-col fixed inset-y-0">
        <div class="px-5 h-16 flex items-center gap-3 border-b border-line">
          <div class="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
            <span class="i-mdi:cloud-sync-outline text-brand text-xl" />
          </div>
          <div>
            <div class="font-semibold text-zinc-100 leading-tight">cloud-ci</div>
            <div class="text-[11px] text-zinc-500">self-healing pipeline</div>
          </div>
        </div>

        <nav class="flex-1 p-3 space-y-1">
          <For each={NAV}>
            {(item) => (
              <Link
                to={item.to}
                activeOptions={{ exact: item.exact }}
                inactiveProps={{
                  class:
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-surface-2 transition-colors',
                }}
                activeProps={{
                  class:
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-brand-dim bg-brand/10 border border-brand/25',
                }}
              >
                <span class={`${item.icon} text-lg`} />
                {item.label}
              </Link>
            )}
          </For>
        </nav>

        <div class="p-4 border-t border-line">
          <Show
            when={health.data?.ok}
            fallback={
              <span class="flex items-center gap-2 text-xs text-zinc-500">
                <span class="w-2 h-2 rounded-full bg-zinc-600" />
                {health.isPending ? 'connecting…' : 'worker unreachable'}
              </span>
            }
          >
            <span class="flex items-center gap-2 text-xs text-emerald-300">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              worker online
            </span>
          </Show>
        </div>
      </aside>

      <main class="flex-1 lg:ml-60 min-w-0">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});
const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: Runs,
});
const runDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$runId',
  component: RunDetail,
});
const healsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/heals',
  component: Heals,
});
const healDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/heals/$runId',
  component: HealDetail,
});
const configRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/config',
  component: Config,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  runsRoute,
  runDetailRoute,
  healsRoute,
  healDetailRoute,
  configRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
