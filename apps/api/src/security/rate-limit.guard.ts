import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { checkFixedWindowRateLimit, type RateLimitBuckets } from '@ai-front-desk/shared';
import { Request } from 'express';

function getStringField(input: unknown, key: string): string | undefined {
  if (typeof input !== 'object' || input === null || !(key in input)) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function getNestedString(input: unknown, keys: string[]): string | undefined {
  let cursor = input;
  for (const key of keys) {
    if (typeof cursor !== 'object' || cursor === null || !(key in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.trim() !== '' ? cursor.trim() : undefined;
}

function getWebhookScope(body: unknown) {
  const entryId = getNestedString(body, ['entry', '0', 'id']);
  const senderId = getNestedString(body, ['entry', '0', 'messaging', '0', 'sender', 'id']);
  if (entryId !== undefined && senderId !== undefined) return `webhook:${entryId}:${senderId}`;
  if (entryId !== undefined) return `webhook:${entryId}`;
  return undefined;
}

function getWhatsAppWebhookScope(body: unknown) {
  const phoneNumberId = getNestedString(body, ['entry', '0', 'changes', '0', 'value', 'metadata', 'phone_number_id']);
  const senderId = getNestedString(body, ['entry', '0', 'changes', '0', 'value', 'messages', '0', 'from']);
  if (phoneNumberId !== undefined && senderId !== undefined) return `webhook:${phoneNumberId}:${senderId}`;
  if (phoneNumberId !== undefined) return `webhook:${phoneNumberId}`;
  return undefined;
}

function getTenantScope(request: Request) {
  const clientId = getStringField(request.params, 'clientId') ?? getStringField(request.query, 'clientId') ?? getStringField(request.body, 'clientId');
  if (clientId !== undefined) return `client:${clientId}`;
  if (request.path.startsWith('/webhooks/messenger')) return getWebhookScope(request.body);
  if (request.path.startsWith('/webhooks/whatsapp')) return getWhatsAppWebhookScope(request.body);
  return undefined;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets: RateLimitBuckets = new Map();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    const ip = request.ip ?? request.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const isWebhook = path.startsWith('/webhooks/messenger') || path.startsWith('/webhooks/whatsapp');
    const limit = isWebhook ? 300 : 120;
    const windowMs = 60_000;
    const tenantScope = getTenantScope(request);
    const key = tenantScope === undefined ? `${ip}:${path}` : `${ip}:${path}:${tenantScope}`;
    const result = await checkFixedWindowRateLimit(
      {
        key,
        limit,
        windowMs,
        prefix: 'afd:api',
        upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
        upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
      },
      this.buckets,
    );

    if (!result.allowed) {
      throw new HttpException('Rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
