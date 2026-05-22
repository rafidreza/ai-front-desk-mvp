export class LoggerService {
  event(name: string, fields: Record<string, unknown> = {}, level: 'log' | 'warn' | 'error' = 'log') {
    console[level](JSON.stringify({ event: name, ...fields }));
  }
}
