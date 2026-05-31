export interface ErrorReportContext {
  dsn?: string;
  environment?: string;
  release?: string;
  runtime?: string;
  tags?: Record<string, string>;
  request?: {
    method?: string;
    url?: string;
  };
  fetchImpl?: typeof fetch;
}

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

function parseSentryDsn(dsn?: string): ParsedDsn | undefined {
  if (dsn === undefined || dsn.trim() === '') return undefined;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean).pop();
    if (url.username === '' || projectId === undefined) return undefined;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/store/`,
      publicKey: url.username,
    };
  } catch {
    return undefined;
  }
}

function errorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      exception: {
        values: [
          {
            type: error.name,
            value: error.message,
          },
        ],
      },
      extra: { stack: error.stack },
    };
  }

  return {
    message: typeof error === 'string' ? error : 'Unknown error',
    extra: { value: error },
  };
}

export async function captureSentryException(error: unknown, context: ErrorReportContext): Promise<boolean> {
  const parsed = parseSentryDsn(context.dsn);
  if (parsed === undefined) return false;

  const fetcher = context.fetchImpl ?? fetch;
  const eventId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}${Math.random().toString(16).slice(2)}`.slice(0, 32);

  const response = await fetcher(parsed.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=daemion-lite/1.0`,
    },
    body: JSON.stringify({
      event_id: eventId,
      platform: 'javascript',
      level: 'error',
      timestamp: new Date().toISOString(),
      environment: context.environment,
      release: context.release,
      tags: {
        runtime: context.runtime ?? 'node',
        ...context.tags,
      },
      request: context.request,
      ...errorPayload(error),
    }),
  });

  return response.ok;
}
