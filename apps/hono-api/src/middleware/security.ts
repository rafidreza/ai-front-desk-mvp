import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import { allowedOrigins, internalApiToken } from '../env';
import { RateLimitError, UnauthorizedError } from '../errors';
import { timingSafeStringEqual } from '../utils/crypto';
import type { AppBindings } from '../db/client';

const publicPrefixes = ['/health', '/webhooks/messenger', '/webhooks/whatsapp', '/web-chat'];
const buckets = new Map<string, { count: number; resetAt: number }>();

export function corsMiddleware() {
  return cors({
    origin: (origin, c) => {
      const origins = allowedOrigins(c.env);
      return origins.includes(origin) ? origin : origins[0] ?? 'http://localhost:3002';
    },
    credentials: false,
    allowHeaders: ['Authorization', 'Content-Type', 'X-Hub-Signature-256'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
}

export const bodyLimitMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const length = c.req.header('content-length');
  if (length !== undefined && Number(length) > 24 * 1024 * 1024) {
    throw new RateLimitError('Request body is larger than the 24 MB limit.');
  }
  await next();
};

export const authMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const path = c.req.path;
  if (publicPrefixes.some((prefix) => path.startsWith(prefix))) {
    await next();
    return;
  }

  const authorization = c.req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (token === undefined || !timingSafeStringEqual(token, internalApiToken(c.env))) {
    throw new UnauthorizedError('API bearer token required.');
  }
  await next();
};

function stringField(input: unknown, key: string) {
  if (typeof input !== 'object' || input === null || !(key in input)) return undefined;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function nestedString(input: unknown, keys: string[]) {
  let cursor = input;
  for (const key of keys) {
    if (typeof cursor !== 'object' || cursor === null || !(key in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.trim() !== '' ? cursor.trim() : undefined;
}

async function parseBodyForScope(c: Parameters<MiddlewareHandler<AppBindings>>[0]) {
  if (!['POST', 'PATCH', 'PUT'].includes(c.req.method)) return undefined;
  try {
    return await c.req.raw.clone().json();
  } catch {
    return undefined;
  }
}

function pathClientId(path: string) {
  const match = path.match(/^\/clients\/([^/]+)/);
  return match?.[1];
}

function webhookScope(path: string, body: unknown) {
  if (path.startsWith('/webhooks/messenger')) {
    const entryId = nestedString(body, ['entry', '0', 'id']);
    const senderId = nestedString(body, ['entry', '0', 'messaging', '0', 'sender', 'id']);
    if (entryId !== undefined && senderId !== undefined) return `webhook:${entryId}:${senderId}`;
    if (entryId !== undefined) return `webhook:${entryId}`;
  }
  if (path.startsWith('/webhooks/whatsapp')) {
    const phoneNumberId = nestedString(body, ['entry', '0', 'changes', '0', 'value', 'metadata', 'phone_number_id']);
    const senderId = nestedString(body, ['entry', '0', 'changes', '0', 'value', 'messages', '0', 'from']);
    if (phoneNumberId !== undefined && senderId !== undefined) return `webhook:${phoneNumberId}:${senderId}`;
    if (phoneNumberId !== undefined) return `webhook:${phoneNumberId}`;
  }
  return undefined;
}

export const rateLimitMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const path = c.req.path;
  const body = await parseBodyForScope(c);
  const clientId = pathClientId(path) ?? stringField(c.req.query(), 'clientId') ?? stringField(body, 'clientId');
  const tenantScope = clientId === undefined ? webhookScope(path, body) : `client:${clientId}`;
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const isWebhook = path.startsWith('/webhooks/messenger') || path.startsWith('/webhooks/whatsapp');
  const limit = isWebhook ? 300 : 120;
  const key = tenantScope === undefined ? `${ip}:${path}` : `${ip}:${path}:${tenantScope}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (bucket === undefined || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    await next();
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new RateLimitError();
  }
  await next();
};
