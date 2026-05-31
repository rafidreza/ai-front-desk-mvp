export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitCheckInput {
  key: string;
  limit: number;
  windowMs: number;
  prefix: string;
  upstashUrl?: string;
  upstashToken?: string;
  now?: number;
  fetchImpl?: typeof fetch;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  count: number;
  resetAt: number;
  store: 'memory' | 'upstash';
  degraded: boolean;
}

export type RateLimitBuckets = Map<string, RateLimitBucket>;

function cleanRedisKey(value: string) {
  return value.replace(/[^A-Za-z0-9:._-]/g, '_').slice(0, 512);
}

function memoryCheck(input: RateLimitCheckInput, buckets: RateLimitBuckets, degraded: boolean): RateLimitCheckResult {
  const now = input.now ?? Date.now();
  const key = `${input.prefix}:${input.key}`;
  const bucket = buckets.get(key);

  if (bucket === undefined || bucket.resetAt <= now) {
    const nextBucket = { count: 1, resetAt: now + input.windowMs };
    buckets.set(key, nextBucket);
    return { allowed: true, count: nextBucket.count, resetAt: nextBucket.resetAt, store: 'memory', degraded };
  }

  bucket.count += 1;
  return {
    allowed: bucket.count <= input.limit,
    count: bucket.count,
    resetAt: bucket.resetAt,
    store: 'memory',
    degraded,
  };
}

async function upstashCheck(input: RateLimitCheckInput): Promise<RateLimitCheckResult> {
  const now = input.now ?? Date.now();
  const url = input.upstashUrl?.replace(/\/+$/, '');
  const token = input.upstashToken;
  const fetcher = input.fetchImpl ?? fetch;
  if (url === undefined || token === undefined || url === '' || token === '') {
    throw new Error('Upstash Redis REST credentials are not configured.');
  }

  const redisKey = cleanRedisKey(`${input.prefix}:${input.key}`);
  const windowSeconds = Math.max(1, Math.ceil(input.windowMs / 1000));
  const response = await fetcher(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, windowSeconds, 'NX'],
      ['TTL', redisKey],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash rate-limit request failed with ${response.status}.`);
  }

  const data = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const count = Number(data[0]?.result);
  const ttl = Number(data[2]?.result);
  if (!Number.isFinite(count)) {
    throw new Error('Upstash rate-limit response did not include a count.');
  }

  const resetAt = now + (Number.isFinite(ttl) && ttl > 0 ? ttl * 1000 : input.windowMs);
  return {
    allowed: count <= input.limit,
    count,
    resetAt,
    store: 'upstash',
    degraded: false,
  };
}

export async function checkFixedWindowRateLimit(input: RateLimitCheckInput, buckets: RateLimitBuckets): Promise<RateLimitCheckResult> {
  if (input.upstashUrl !== undefined && input.upstashToken !== undefined && input.upstashUrl !== '' && input.upstashToken !== '') {
    try {
      return await upstashCheck(input);
    } catch {
      return memoryCheck(input, buckets, true);
    }
  }

  return memoryCheck(input, buckets, false);
}
