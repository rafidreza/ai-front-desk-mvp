import { checkFixedWindowRateLimit, type RateLimitBuckets } from '@ai-front-desk/shared';
import { describe, expect, it, vi } from 'vitest';

describe('checkFixedWindowRateLimit', () => {
  it('uses a local fixed-window bucket when shared Redis is not configured', async () => {
    const buckets: RateLimitBuckets = new Map();

    await expect(
      checkFixedWindowRateLimit({ key: 'login:1.1.1.1', limit: 2, windowMs: 60_000, prefix: 'test', now: 1000 }, buckets),
    ).resolves.toMatchObject({ allowed: true, count: 1, store: 'memory', degraded: false });

    await expect(
      checkFixedWindowRateLimit({ key: 'login:1.1.1.1', limit: 2, windowMs: 60_000, prefix: 'test', now: 1001 }, buckets),
    ).resolves.toMatchObject({ allowed: true, count: 2 });

    await expect(
      checkFixedWindowRateLimit({ key: 'login:1.1.1.1', limit: 2, windowMs: 60_000, prefix: 'test', now: 1002 }, buckets),
    ).resolves.toMatchObject({ allowed: false, count: 3 });
  });

  it('uses Upstash Redis REST when credentials are configured', async () => {
    const buckets: RateLimitBuckets = new Map();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 2 }, { result: 1 }, { result: 60 }],
    });

    const result = await checkFixedWindowRateLimit(
      {
        key: 'ip:/path',
        limit: 5,
        windowMs: 60_000,
        prefix: 'test',
        upstashUrl: 'https://redis.example.com/',
        upstashToken: 'token',
        now: 10_000,
        fetchImpl,
      },
      buckets,
    );

    expect(result).toMatchObject({ allowed: true, count: 2, resetAt: 70_000, store: 'upstash', degraded: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://redis.example.com/pipeline',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('falls back to memory when the shared store is temporarily unavailable', async () => {
    const buckets: RateLimitBuckets = new Map();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    const result = await checkFixedWindowRateLimit(
      {
        key: 'ip:/path',
        limit: 5,
        windowMs: 60_000,
        prefix: 'test',
        upstashUrl: 'https://redis.example.com',
        upstashToken: 'token',
        fetchImpl,
      },
      buckets,
    );

    expect(result).toMatchObject({ allowed: true, count: 1, store: 'memory', degraded: true });
  });
});
