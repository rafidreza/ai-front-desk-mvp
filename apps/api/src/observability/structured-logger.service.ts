import { Injectable, Logger } from '@nestjs/common';

type LogLevel = 'log' | 'warn' | 'error';

@Injectable()
export class StructuredLoggerService {
  private readonly logger = new Logger('AIFrontDesk');

  event(event: string, payload: Record<string, unknown> = {}, level: LogLevel = 'log'): void {
    this.logger[level](
      JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    );
  }
}
