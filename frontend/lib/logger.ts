/**
 * Structured logging helper for frontend
 * Provides consistent log formatting with categories
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  [key: string]: any;
}

const formatLog = (level: LogLevel, message: string, data?: LogData): string => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }

  return `${prefix} ${message}`;
};

export const logger = {
  /**
   * Log informational messages
   */
  info: (message: string, data?: LogData) => {
    console.info(formatLog('info', message, data));
  },

  /**
   * Log warnings
   */
  warn: (message: string, data?: LogData) => {
    console.warn(formatLog('warn', message, data));
  },

  /**
   * Log errors with optional error object
   */
  error: (message: string, error?: Error | any, data?: LogData) => {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack, ...data }
      : { error, ...data };

    console.error(formatLog('error', message, errorData));
  },

  /**
   * Log debug information (only in development)
   */
  debug: (message: string, data?: LogData) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog('debug', message, data));
    }
  },

  /**
   * Log fallback events (GraphQL → RPC, etc.)
   */
  fallback: (from: string, to: string, reason?: string, data?: LogData) => {
    const fallbackData = {
      from,
      to,
      reason: reason || 'unknown',
      ...data,
    };
    console.warn(formatLog('warn', `Fallback: ${from} → ${to}`, fallbackData));
  },

  /**
   * Log retry attempts
   */
  retry: (attempt: number, maxRetries: number, delay: number, reason?: string) => {
    const retryData = {
      attempt,
      maxRetries,
      delayMs: delay,
      reason: reason || 'unknown error',
    };
    console.warn(formatLog('warn', `Retry ${attempt}/${maxRetries} (${delay}ms delay)`, retryData));
  },
};
