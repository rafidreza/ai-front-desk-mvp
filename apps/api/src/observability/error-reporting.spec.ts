import { captureSentryException } from '@ai-front-desk/shared';
import { describe, expect, it, vi } from 'vitest';

describe('captureSentryException', () => {
  it('does nothing when Sentry is not configured', async () => {
    const fetchImpl = vi.fn();

    await expect(captureSentryException(new Error('boom'), { fetchImpl })).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts a normalized error event to the Sentry store endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      captureSentryException(new Error('database unavailable'), {
        dsn: 'https://public-key@sentry.example.com/123',
        environment: 'staging',
        release: 'abc123',
        runtime: 'nest-api',
        request: { method: 'GET', url: '/health/db' },
        fetchImpl,
      }),
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://sentry.example.com/api/123/store/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Sentry-Auth': expect.stringContaining('sentry_key=public-key'),
        }),
      }),
    );
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      environment: 'staging',
      release: 'abc123',
      message: 'database unavailable',
      request: { method: 'GET', url: '/health/db' },
    });
  });
});
