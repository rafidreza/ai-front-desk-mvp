import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}

export class RateLimitError extends HttpError {
  constructor(message = 'Rate limit exceeded.') {
    super(429, message);
  }
}

export function normalizeError(error: unknown) {
  if (error instanceof HttpError) {
    return { status: error.status, body: { statusCode: error.status, message: error.message } };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        statusCode: 400,
        message: 'Validation failed.',
        errors: error.issues,
      },
    };
  }
  const message = error instanceof Error ? error.message : 'Internal server error.';
  return {
    status: 500,
    body: {
      statusCode: 500,
      message,
    },
  };
}
