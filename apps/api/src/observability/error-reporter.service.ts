import { Injectable } from '@nestjs/common';
import { captureSentryException } from '@ai-front-desk/shared';

interface ErrorReportInput {
  error: unknown;
  runtime: string;
  request?: {
    method?: string;
    url?: string;
  };
  tags?: Record<string, string>;
}

@Injectable()
export class ErrorReporterService {
  capture(input: ErrorReportInput) {
    void captureSentryException(input.error, {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.APP_VERSION,
      runtime: input.runtime,
      request: input.request,
      tags: input.tags,
    }).catch(() => undefined);
  }
}
