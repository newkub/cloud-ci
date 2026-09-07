import { createORPCClient, onError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { RouterClient } from '@orpc/server';
import { QueryClient } from '@tanstack/solid-query';
import type { AppRouter } from '../../src/api/router';
import type { HealRecord, RunRecord } from '../../src/registry';

const link = new RPCLink({
  url: `${globalThis.location?.origin ?? 'http://localhost:8787'}/rpc`,
  interceptors: [
    onError((error) => {
      console.error('oRPC request failed', error);
    }),
  ],
});

export const orpc: RouterClient<AppRouter> = createORPCClient(link);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10_000,
      retry: 1,
      staleTime: 3_000,
    },
  },
});

export type { HealRecord, RunRecord };
export type RunWithHeal = RunRecord & { heal: HealRecord | null };
