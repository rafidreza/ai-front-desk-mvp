import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    const ip = request.ip ?? request.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const isWebhook = path.startsWith('/webhooks/messenger');
    const limit = isWebhook ? 300 : 120;
    const windowMs = 60_000;
    const key = `${ip}:${path}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (bucket === undefined || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException('Rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
