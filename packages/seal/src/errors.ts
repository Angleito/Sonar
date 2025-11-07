/**
 * @sonar/seal - Error Classes
 * Custom error types for better error handling
 */

import { SealErrorCode } from './types';

/**
 * Base Seal error class
 */
export class SealError extends Error {
  constructor(
    public readonly code: SealErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SealError';

    // Maintain proper stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SealError);
    }
  }

  /**
   * Convert to JSON for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

/**
 * Configuration error
 */
export class ConfigError extends SealError {
  constructor(message: string, cause?: Error) {
    super(SealErrorCode.INVALID_CONFIG, message, cause);
    this.name = 'ConfigError';
  }
}

/**
 * Encryption error
 */
export class EncryptionError extends SealError {
  constructor(message: string, cause?: Error) {
    super(SealErrorCode.ENCRYPTION_FAILED, message, cause);
    this.name = 'EncryptionError';
  }
}

/**
 * Decryption error
 */
export class DecryptionError extends SealError {
  constructor(
    code: SealErrorCode = SealErrorCode.DECRYPTION_FAILED,
    message: string,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'DecryptionError';
  }
}

/**
 * Session error
 */
export class SessionError extends SealError {
  constructor(
    code: SealErrorCode = SealErrorCode.SESSION_INVALID,
    message: string,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'SessionError';
  }
}

/**
 * Network/timeout error
 */
export class NetworkError extends SealError {
  constructor(message: string, cause?: Error) {
    super(SealErrorCode.NETWORK_ERROR, message, cause);
    this.name = 'NetworkError';
  }
}

/**
 * Policy denied error (access control failure)
 */
export class PolicyDeniedError extends DecryptionError {
  constructor(policyModule: string, message?: string) {
    super(
      SealErrorCode.POLICY_DENIED,
      message || `Access denied by policy: ${policyModule}`,
    );
    this.name = 'PolicyDeniedError';
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends SessionError {
  constructor(expiresAt?: number) {
    const message = expiresAt
      ? `Session expired at ${new Date(expiresAt).toISOString()}`
      : 'Session has expired';
    super(SealErrorCode.SESSION_EXPIRED, message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Helper to check if error is a Seal error
 */
export function isSealError(error: unknown): error is SealError {
  return error instanceof SealError;
}

/**
 * Helper to get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (!isSealError(error)) {
    return 'An unexpected error occurred';
  }

  switch (error.code) {
    case SealErrorCode.SESSION_EXPIRED:
      return 'Your session has expired. Please reconnect your wallet.';

    case SealErrorCode.POLICY_DENIED:
      return 'You do not have access to this content.';

    case SealErrorCode.DECRYPTION_FAILED:
      return 'Failed to decrypt content. Please try again.';

    case SealErrorCode.ENCRYPTION_FAILED:
      return 'Failed to encrypt file. Please try again.';

    case SealErrorCode.KEY_SERVER_ERROR:
      return 'Decryption service is temporarily unavailable. Please try again later.';

    case SealErrorCode.TIMEOUT:
      return 'Request timed out. Please check your connection.';

    case SealErrorCode.NETWORK_ERROR:
      return 'Network error. Please check your connection.';

    default:
      return error.message || 'An error occurred';
  }
}

/**
 * Wrap async function with error handling
 */
export function wrapWithErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorCode: SealErrorCode,
  ErrorClass: typeof SealError = SealError
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isSealError(error)) {
        throw error; // Re-throw Seal errors as-is
      }
      throw new ErrorClass(
        errorCode,
        error instanceof Error ? error.message : 'Unknown error',
        error instanceof Error ? error : undefined
      );
    }
  }) as T;
}
