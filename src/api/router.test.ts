import { describe, expect, it, vi } from 'vitest';
import { RPCHandler } from '@orpc/server/fetch';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Bindings } from '../../env';
import { router } from './router';

function makeEnv(registry: Record<string, unknown> = {}) {
  const stub = {
    stats: vi.fn().mockResolvedValue({ totalRuns: 3, successRate: 0.5 }),
    listRuns: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getRun: vi.fn().mockResolvedValue(null),
    listHeals: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getHeal: vi.fn().mockResolvedValue(null),
    ...registry,
  };
  return fromPartial<Bindings>({
    REGISTRY: fromPartial<DurableObjectNamespace>({
      idFromName: vi.fn().mockReturnValue(fromPartial<DurableObjectId>({})),
      get: vi.fn().mockReturnValue(stub),
    }),
  });
}

async function call(
  path: string,
  input: unknown = {},
  env: Bindings = makeEnv()
) {
  const handler = new RPCHandler(router);
  const { matched, response } = await handler.handle(
    new Request(`http://test.local/rpc/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json: input }),
    }),
    { prefix: '/rpc', context: { env } }
  );
  if (!matched) {
    return { status: 404, body: null };
  }
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
  };
}

describe('oRPC router', () => {
  it('reports missing bindings in health', async () => {
    const { status, body } = await call('health');
    expect(status).toBe(200);
    const json = body?.json as Record<string, unknown>;
    expect(json.name).toBe('cloud-ci');
    expect(json.ok).toBe(false);
    expect(String(json.bindings)).toContain('missing:');
  });

  it('returns stats from the registry', async () => {
    const env = makeEnv();
    const { status, body } = await call('stats', {}, env);
    expect(status).toBe(200);
    const json = body?.json as Record<string, unknown>;
    expect(json.totalRuns).toBe(3);
  });

  it('validates runs.list input', async () => {
    const { status } = await call('runs/list', { status: 'bogus' });
    expect(status).toBe(400);
  });

  it('returns NOT_FOUND for unknown run', async () => {
    const { status, body } = await call('runs/get', { id: 'missing' });
    expect(status).toBe(404);
    const json = body?.json as Record<string, unknown>;
    expect(json.code).toBe('NOT_FOUND');
  });

  it('returns run with attached heal when found', async () => {
    const env = makeEnv({
      getRun: vi.fn().mockResolvedValue({
        id: 'run-1',
        status: 'healed',
        heal: { runId: 'run-1', status: 'pushed', steps: 5 },
      }),
    });
    const { status, body } = await call('runs/get', { id: 'run-1' }, env);
    expect(status).toBe(200);
    const json = body?.json as Record<string, unknown>;
    expect(json.id).toBe('run-1');
    expect((json.heal as Record<string, unknown>).status).toBe('pushed');
  });

  it('returns watch config from env vars', async () => {
    const env = makeEnv();
    (env as unknown as Record<string, unknown>).WATCH_NAMESPACE = 'ns';
    const { status, body } = await call('watch/config', {}, env);
    expect(status).toBe(200);
    const json = body?.json as Record<string, unknown>;
    expect(json.namespace).toBe('ns');
    expect(json.repo).toBe('cloud-ci');
  });
});
