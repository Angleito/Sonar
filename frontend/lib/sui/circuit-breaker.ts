import { logger } from '@/lib/logger';

/**
 * Circuit Breaker States
 *
 * CLOSED: Normal operation, requests flow through
 * OPEN: Failure threshold exceeded, failing fast without attempting requests
 * HALF_OPEN: Testing if service has recovered with limited requests
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Consecutive failures before opening circuit
  cooldownMs: number; // Time to wait before testing recovery
  halfOpenMaxAttempts: number; // Max test requests in HALF_OPEN state
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  lastStateChange?: number;
}

/**
 * Circuit Breaker for GraphQL Endpoints
 *
 * Implements the Circuit Breaker pattern to prevent wasting time on failing endpoints:
 * - Tracks consecutive failures per endpoint
 * - Opens circuit after failure threshold (fails fast)
 * - Automatically attempts recovery after cooldown period
 * - Provides observability through structured logging
 */
export class CircuitBreaker {
  private circuits: Map<string, CircuitStats> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: Math.max(1, config?.failureThreshold ?? 3), // Minimum threshold of 1
      cooldownMs: Math.max(100, config?.cooldownMs ?? 60_000), // Minimum 100ms cooldown
      halfOpenMaxAttempts: Math.max(1, config?.halfOpenMaxAttempts ?? 1), // Minimum 1 attempt
    };
  }

  /**
   * Check if a request can be attempted for the given endpoint
   *
   * @param endpointName - Unique identifier for the endpoint
   * @returns true if request should be attempted, false if circuit is OPEN
   */
  canAttempt(endpointName: string): boolean {
    const stats = this.getOrCreateStats(endpointName);
    const now = Date.now();

    switch (stats.state) {
      case CircuitState.CLOSED:
        // Normal operation
        return true;

      case CircuitState.OPEN:
        // Check if cooldown period has elapsed
        if (stats.lastFailureTime && now - stats.lastFailureTime >= this.config.cooldownMs) {
          // Transition to HALF_OPEN to test recovery
          this.transitionState(endpointName, CircuitState.HALF_OPEN);
          logger.info(`Circuit breaker ${endpointName}: OPEN → HALF_OPEN (testing recovery)`, {
            cooldownMs: this.config.cooldownMs,
          });
          return true;
        }
        // Circuit still open, fail fast
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited test requests
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   *
   * @param endpointName - Unique identifier for the endpoint
   */
  recordSuccess(endpointName: string): void {
    const stats = this.getOrCreateStats(endpointName);
    const now = Date.now();

    stats.successes += 1;
    stats.failures = 0; // Reset failure counter on success
    stats.lastSuccessTime = now;

    // If recovering from failure, close the circuit
    if (stats.state === CircuitState.HALF_OPEN) {
      this.transitionState(endpointName, CircuitState.CLOSED);
      logger.info(`Circuit breaker ${endpointName}: HALF_OPEN → CLOSED (recovery successful)`, {
        totalSuccesses: stats.successes,
      });
    } else if (stats.state === CircuitState.OPEN) {
      // Should not happen, but handle gracefully
      this.transitionState(endpointName, CircuitState.CLOSED);
      logger.warn(`Circuit breaker ${endpointName}: OPEN → CLOSED (unexpected success)`, {
        totalSuccesses: stats.successes,
      });
    }
  }

  /**
   * Record a failed request
   *
   * @param endpointName - Unique identifier for the endpoint
   * @param error - Optional error object for logging
   */
  recordFailure(endpointName: string, error?: Error): void {
    const stats = this.getOrCreateStats(endpointName);
    const now = Date.now();

    stats.failures += 1;
    stats.lastFailureTime = now;

    logger.warn(`Circuit breaker ${endpointName}: Request failed`, {
      consecutiveFailures: stats.failures,
      threshold: this.config.failureThreshold,
      state: stats.state,
      error: error?.message,
    });

    // Check if we should open the circuit
    if (stats.state === CircuitState.CLOSED && stats.failures >= this.config.failureThreshold) {
      this.transitionState(endpointName, CircuitState.OPEN);
      logger.error(`Circuit breaker ${endpointName}: CLOSED → OPEN (failure threshold exceeded)`, {
        consecutiveFailures: stats.failures,
        threshold: this.config.failureThreshold,
        cooldownMs: this.config.cooldownMs,
      });
    } else if (stats.state === CircuitState.HALF_OPEN) {
      // Recovery attempt failed, back to OPEN
      this.transitionState(endpointName, CircuitState.OPEN);
      logger.error(`Circuit breaker ${endpointName}: HALF_OPEN → OPEN (recovery failed)`, {
        consecutiveFailures: stats.failures,
        cooldownMs: this.config.cooldownMs,
      });
    }
  }

  /**
   * Get current state of a circuit
   *
   * @param endpointName - Unique identifier for the endpoint
   * @returns Current circuit state
   */
  getState(endpointName: string): CircuitState {
    return this.getOrCreateStats(endpointName).state;
  }

  /**
   * Get detailed statistics for a circuit
   *
   * @param endpointName - Unique identifier for the endpoint
   * @returns Circuit statistics
   */
  getStats(endpointName: string): Readonly<CircuitStats> {
    return { ...this.getOrCreateStats(endpointName) };
  }

  /**
   * Get statistics for all circuits
   *
   * @returns Map of endpoint names to circuit statistics
   */
  getAllStats(): Map<string, Readonly<CircuitStats>> {
    const allStats = new Map<string, Readonly<CircuitStats>>();
    this.circuits.forEach((stats, name) => {
      allStats.set(name, { ...stats });
    });
    return allStats;
  }

  /**
   * Manually reset a circuit to CLOSED state
   * Useful for testing or manual recovery
   *
   * @param endpointName - Unique identifier for the endpoint
   */
  reset(endpointName: string): void {
    const stats = this.getOrCreateStats(endpointName);
    stats.state = CircuitState.CLOSED;
    stats.failures = 0;
    stats.lastStateChange = Date.now();

    logger.info(`Circuit breaker ${endpointName}: Manually reset to CLOSED`);
  }

  /**
   * Reset all circuits to CLOSED state
   */
  resetAll(): void {
    this.circuits.forEach((_, name) => this.reset(name));
    logger.info('Circuit breaker: All circuits reset to CLOSED');
  }

  /**
   * Get or create circuit stats for an endpoint
   */
  private getOrCreateStats(endpointName: string): CircuitStats {
    if (!this.circuits.has(endpointName)) {
      this.circuits.set(endpointName, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastStateChange: Date.now(),
      });
    }
    return this.circuits.get(endpointName)!;
  }

  /**
   * Transition circuit to a new state
   */
  private transitionState(endpointName: string, newState: CircuitState): void {
    const stats = this.getOrCreateStats(endpointName);
    stats.state = newState;
    stats.lastStateChange = Date.now();

    // Reset failure counter when transitioning to HALF_OPEN or CLOSED
    if (newState === CircuitState.HALF_OPEN || newState === CircuitState.CLOSED) {
      stats.failures = 0;
    }
  }
}

/**
 * Global circuit breaker instance for GraphQL endpoints
 * Shared across all repository instances for consistent state tracking
 */
export const graphqlCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  cooldownMs: 60_000, // 60 seconds
  halfOpenMaxAttempts: 1,
});
