import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

const publicPrefixes = ['/health', '/webhooks/messenger', '/webhooks/whatsapp', '/web-chat'];

function getExpectedToken() {
  const token = process.env.INTERNAL_API_TOKEN;
  if (process.env.NODE_ENV === 'production' && (token === undefined || token.length < 32)) {
    throw new Error('INTERNAL_API_TOKEN must be set to at least 32 characters in production.');
  }
  return token ?? 'dev-internal-api-token-only-for-local-work';
}

function matchesToken(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

@Injectable()
export class ApiAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    if (publicPrefixes.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
    if (token === undefined || !matchesToken(token, getExpectedToken())) {
      throw new UnauthorizedException('API bearer token required.');
    }

    return true;
  }
}
