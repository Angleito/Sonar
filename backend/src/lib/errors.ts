import { ErrorCode, ERROR_MESSAGES, type ErrorResponse } from '@sonar/shared';

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message?: string,
    details?: unknown
  ) {
    super(message ?? ERROR_MESSAGES[code] ?? 'Unexpected error');
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function toErrorResponse(error: unknown): {
  statusCode: number;
  body: ErrorResponse;
} {
  if (isHttpError(error)) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.code,
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  const message =
    error instanceof Error
      ? error.message
      : ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR];

  return {
    statusCode: 500,
    body: {
      error: ErrorCode.INTERNAL_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message,
    },
  };
}

export function invalidRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, ErrorCode.INVALID_REQUEST, message, details);
}

export function notFound(message: string, details?: unknown): HttpError {
  return new HttpError(404, ErrorCode.DATASET_NOT_FOUND, message, details);
}
