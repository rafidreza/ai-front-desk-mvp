import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiAuthGuard } from './api-auth.guard';

function contextFor(path: string, authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        path,
        header: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined),
      }),
    }),
  } as ExecutionContext;
}

describe('ApiAuthGuard', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, INTERNAL_API_TOKEN: 'x'.repeat(40), NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('bypasses health and Messenger webhook routes', () => {
    const guard = new ApiAuthGuard();

    expect(guard.canActivate(contextFor('/health'))).toBe(true);
    expect(guard.canActivate(contextFor('/webhooks/messenger'))).toBe(true);
    expect(guard.canActivate(contextFor('/webhooks/whatsapp'))).toBe(true);
  });

  it('requires a valid bearer token for protected routes', () => {
    const guard = new ApiAuthGuard();

    expect(guard.canActivate(contextFor('/clients/pilot-client/knowledge', `Bearer ${'x'.repeat(40)}`))).toBe(true);
    expect(() => guard.canActivate(contextFor('/clients/pilot-client/knowledge', `Bearer ${'x'.repeat(39)}y`))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextFor('/clients/pilot-client/knowledge'))).toThrow(UnauthorizedException);
  });
});
