/*
 * cloud-ci worker: pipelines are started by the `cf.artifacts.repo.pushed`
 * trigger wired to the Workflow in wrangler.jsonc. The fetch handler answers
 * the health check, serves the type-safe oRPC API under /rpc, and delegates
 * everything else to the static dashboard assets.
 */

import { Hono } from 'hono';
import { RPCHandler } from '@orpc/server/fetch';
import { onError } from '@orpc/server';
import { CiSandbox } from '@cloudflare/ci/worker';
import type { Bindings, Env } from '../env';
import { router } from './api/router';

export { CiSandbox };
export { CI, Healer } from '../cloudflare.ci';
export { RunRegistry } from './registry';

const app = new Hono<Env>();

// health check
app.get('/health', (c) => c.json({ ok: true }));

const rpcHandler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error('oRPC error', error);
    }),
  ],
});

export default {
  fetch: async (request, env, ctx) => {
    const url = new URL(request.url);
    if (url.pathname === '/rpc' || url.pathname.startsWith('/rpc/')) {
      const { matched, response } = await rpcHandler.handle(request, {
        prefix: '/rpc',
        context: { env },
      });
      if (matched) {
        return response;
      }
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (url.pathname === '/health') {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Bindings>;
