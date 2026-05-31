import { ExecutionContext, HttpException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RateLimitGuard } from './rate-limit.guard';

function contextFor(input: {
  path: string;
  ip?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        path: input.path,
        ip: input.ip,
        params: input.params ?? {},
        query: input.query ?? {},
        body: input.body,
        header: (name: string) => (name.toLowerCase() === 'x-forwarded-for' ? input.ip : undefined),
      }),
    }),
  } as ExecutionContext;
}

describe('RateLimitGuard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets a bucket after the window expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T00:00:00Z'));
    const guard = new RateLimitGuard();
    const context = contextFor({ path: '/client-auth/request', ip: '1.1.1.1' });

    for (let index = 0; index < 120; index += 1) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    vi.setSystemTime(new Date('2026-05-16T00:01:01Z'));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('uses tenant scope so clients behind the same IP do not share one bucket', async () => {
    const guard = new RateLimitGuard();
    const clientA = contextFor({ path: '/clients/client-a/knowledge', ip: '2.2.2.2', params: { clientId: 'client-a' } });
    const clientB = contextFor({ path: '/clients/client-a/knowledge', ip: '2.2.2.2', params: { clientId: 'client-b' } });

    for (let index = 0; index < 120; index += 1) {
      await expect(guard.canActivate(clientA)).resolves.toBe(true);
    }

    await expect(guard.canActivate(clientA)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(clientB)).resolves.toBe(true);
  });
});
