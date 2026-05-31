import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response, Request } from 'express';
import { ErrorReporterService } from './error-reporter.service';

function responseBody(exception: unknown, statusCode: number) {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === 'object' && response !== null) return response;
    return { statusCode, message: String(response) };
  }

  return { statusCode, message: 'Internal server error.' };
}

@Catch()
export class ErrorReportingFilter implements ExceptionFilter {
  constructor(private readonly reporter: ErrorReporterService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;

    if (statusCode >= 500) {
      this.reporter.capture({
        error: exception,
        runtime: 'nest-api',
        request: {
          method: request.method,
          url: request.originalUrl ?? request.url,
        },
      });
    }

    response.status(statusCode).json(responseBody(exception, statusCode));
  }
}
