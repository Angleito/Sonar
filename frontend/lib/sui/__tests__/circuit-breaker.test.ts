import { describe, test, expect, beforeEach } from 'bun:test';
import { CircuitBreaker, CircuitState } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 1000, // 1 second for faster tests
      halfOpenMaxAttempts: 1,
    });
  });

  describe('Initial State', () => {
    test('starts in CLOSED state', () => {
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);
    });

    test('allows requests in CLOSED state', () => {
      expect(breaker.canAttempt('test-endpoint')).toBe(true);
    });

    test('has zero failures initially', () => {
      const stats = breaker.getStats('test-endpoint');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });
  });

  describe('Success Recording', () => {
    test('records successful requests', () => {
      breaker.recordSuccess('test-endpoint');
      const stats = breaker.getStats('test-endpoint');
      expect(stats.successes).toBe(1);
      expect(stats.failures).toBe(0);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    test('resets failure count on success', () => {
      breaker.recordFailure('test-endpoint');
      breaker.recordFailure('test-endpoint');
      expect(breaker.getStats('test-endpoint').failures).toBe(2);

      breaker.recordSuccess('test-endpoint');
      expect(breaker.getStats('test-endpoint').failures).toBe(0);
      expect(breaker.getStats('test-endpoint').successes).toBe(1);
    });

    test('updates lastSuccessTime', () => {
      const beforeTime = Date.now();
      breaker.recordSuccess('test-endpoint');
      const stats = breaker.getStats('test-endpoint');

      expect(stats.lastSuccessTime).toBeDefined();
      expect(stats.lastSuccessTime!).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('Failure Recording', () => {
    test('records failed requests', () => {
      breaker.recordFailure('test-endpoint');
      const stats = breaker.getStats('test-endpoint');
      expect(stats.failures).toBe(1);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    test('increments failure count consecutively', () => {
      breaker.recordFailure('test-endpoint');
      breaker.recordFailure('test-endpoint');
      breaker.recordFailure('test-endpoint');

      const stats = breaker.getStats('test-endpoint');
      expect(stats.failures).toBe(3);
    });

    test('records error message', () => {
      const error = new Error('Connection timeout');
      breaker.recordFailure('test-endpoint', error);
      // Note: This test just verifies no errors are thrown
      // Actual error logging is tested via logger mock
      expect(breaker.getStats('test-endpoint').failures).toBe(1);
    });

    test('updates lastFailureTime', () => {
      const beforeTime = Date.now();
      breaker.recordFailure('test-endpoint');
      const stats = breaker.getStats('test-endpoint');

      expect(stats.lastFailureTime).toBeDefined();
      expect(stats.lastFailureTime!).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('State Transitions: CLOSED → OPEN', () => {
    test('opens circuit after failure threshold', () => {
      // Record failures up to threshold
      breaker.recordFailure('test-endpoint');
      breaker.recordFailure('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);

      // Threshold breach
      breaker.recordFailure('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);
    });

    test('rejects requests when OPEN', () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }

      expect(breaker.canAttempt('test-endpoint')).toBe(false);
    });

    test('tracks multiple endpoints independently', () => {
      // Trip circuit for endpoint1
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('endpoint1');
      }

      // endpoint1 should be OPEN
      expect(breaker.getState('endpoint1')).toBe(CircuitState.OPEN);
      expect(breaker.canAttempt('endpoint1')).toBe(false);

      // endpoint2 should still be CLOSED
      expect(breaker.getState('endpoint2')).toBe(CircuitState.CLOSED);
      expect(breaker.canAttempt('endpoint2')).toBe(true);
    });
  });

  describe('State Transitions: OPEN → HALF_OPEN', () => {
    test('transitions to HALF_OPEN after cooldown', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 1100)); // cooldownMs = 1000

      // Should allow attempt and transition to HALF_OPEN
      expect(breaker.canAttempt('test-endpoint')).toBe(true);
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.HALF_OPEN);
    });

    test('stays OPEN before cooldown expires', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }

      // Check immediately (before cooldown)
      expect(breaker.canAttempt('test-endpoint')).toBe(false);
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);

      // Check again before cooldown expires
      await new Promise(resolve => setTimeout(resolve, 500)); // Half of cooldown
      expect(breaker.canAttempt('test-endpoint')).toBe(false);
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);
    });
  });

  describe('State Transitions: HALF_OPEN → CLOSED', () => {
    test('closes circuit on successful recovery', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Transition to HALF_OPEN
      breaker.canAttempt('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.HALF_OPEN);

      // Record success (recovery)
      breaker.recordSuccess('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);
      expect(breaker.canAttempt('test-endpoint')).toBe(true);
    });

    test('resets failure count on successful recovery', async () => {
      // Trip and recover
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }
      await new Promise(resolve => setTimeout(resolve, 1100));
      breaker.canAttempt('test-endpoint');
      breaker.recordSuccess('test-endpoint');

      const stats = breaker.getStats('test-endpoint');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(1);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('State Transitions: HALF_OPEN → OPEN', () => {
    test('reopens circuit if recovery attempt fails', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }

      // Wait and transition to HALF_OPEN
      await new Promise(resolve => setTimeout(resolve, 1100));
      breaker.canAttempt('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.HALF_OPEN);

      // Recovery fails
      breaker.recordFailure('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);
      expect(breaker.canAttempt('test-endpoint')).toBe(false);
    });
  });

  describe('Manual Reset', () => {
    test('resets single circuit to CLOSED', () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);

      // Manual reset
      breaker.reset('test-endpoint');
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);
      expect(breaker.getStats('test-endpoint').failures).toBe(0);
      expect(breaker.canAttempt('test-endpoint')).toBe(true);
    });

    test('resets all circuits', () => {
      // Trip multiple circuits
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('endpoint1');
        breaker.recordFailure('endpoint2');
      }

      expect(breaker.getState('endpoint1')).toBe(CircuitState.OPEN);
      expect(breaker.getState('endpoint2')).toBe(CircuitState.OPEN);

      // Reset all
      breaker.resetAll();

      expect(breaker.getState('endpoint1')).toBe(CircuitState.CLOSED);
      expect(breaker.getState('endpoint2')).toBe(CircuitState.CLOSED);
      expect(breaker.canAttempt('endpoint1')).toBe(true);
      expect(breaker.canAttempt('endpoint2')).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('returns stats for all circuits', () => {
      breaker.recordFailure('endpoint1');
      breaker.recordSuccess('endpoint2');
      breaker.recordFailure('endpoint3');
      breaker.recordFailure('endpoint3');

      const allStats = breaker.getAllStats();
      expect(allStats.size).toBe(3);
      expect(allStats.get('endpoint1')?.failures).toBe(1);
      expect(allStats.get('endpoint2')?.successes).toBe(1);
      expect(allStats.get('endpoint3')?.failures).toBe(2);
    });

    test('returns immutable stats copies', () => {
      breaker.recordFailure('test-endpoint');
      const stats1 = breaker.getStats('test-endpoint');
      const stats2 = breaker.getStats('test-endpoint');

      // Modifying one shouldn't affect the other
      (stats1 as any).failures = 999;
      expect(stats2.failures).toBe(1);
    });

    test('tracks lastStateChange timestamp', async () => {
      const beforeTime = Date.now();

      // Initial CLOSED state
      breaker.recordFailure('test-endpoint');
      const closedStats = breaker.getStats('test-endpoint');
      expect(closedStats.lastStateChange).toBeDefined();
      expect(closedStats.lastStateChange!).toBeGreaterThanOrEqual(beforeTime);

      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Transition to OPEN (need 3 total failures for threshold of 3)
      breaker.recordFailure('test-endpoint');
      breaker.recordFailure('test-endpoint');
      const openStats = breaker.getStats('test-endpoint');
      expect(openStats.state).toBe(CircuitState.OPEN); // Verify state changed
      expect(openStats.lastStateChange).toBeGreaterThan(closedStats.lastStateChange!);
    });
  });

  describe('Edge Cases', () => {
    test('handles zero failure threshold (enforces minimum of 1)', () => {
      const strictBreaker = new CircuitBreaker({ failureThreshold: 0 });

      // Circuit breaker enforces minimum threshold of 1
      // So first failure should trip it
      strictBreaker.recordFailure('test-endpoint');
      expect(strictBreaker.getState('test-endpoint')).toBe(CircuitState.OPEN);
    });

    test('handles multiple rapid successes', () => {
      for (let i = 0; i < 100; i++) {
        breaker.recordSuccess('test-endpoint');
      }

      const stats = breaker.getStats('test-endpoint');
      expect(stats.successes).toBe(100);
      expect(stats.failures).toBe(0);
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    test('handles alternating success and failure', () => {
      for (let i = 0; i < 10; i++) {
        breaker.recordFailure('test-endpoint');
        breaker.recordSuccess('test-endpoint'); // Resets failure count
      }

      const stats = breaker.getStats('test-endpoint');
      expect(stats.state).toBe(CircuitState.CLOSED); // Never reached threshold
      expect(stats.failures).toBe(0); // Reset by last success
      expect(stats.successes).toBe(10);
    });

    test('handles success in OPEN state', async () => {
      // Trip circuit
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure('test-endpoint');
      }
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.OPEN);

      // Somehow a request succeeds while OPEN (shouldn't happen, but test graceful handling)
      breaker.recordSuccess('test-endpoint');

      // Should transition to CLOSED
      expect(breaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);
    });
  });

  describe('Configuration', () => {
    test('respects custom failure threshold', () => {
      const customBreaker = new CircuitBreaker({ failureThreshold: 5 });

      // Should stay closed for 4 failures
      for (let i = 0; i < 4; i++) {
        customBreaker.recordFailure('test-endpoint');
      }
      expect(customBreaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);

      // 5th failure should trip it
      customBreaker.recordFailure('test-endpoint');
      expect(customBreaker.getState('test-endpoint')).toBe(CircuitState.OPEN);
    });

    test('respects custom cooldown period', async () => {
      const customBreaker = new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 500, // 0.5 seconds
      });

      // Trip circuit
      customBreaker.recordFailure('test-endpoint');
      customBreaker.recordFailure('test-endpoint');
      expect(customBreaker.getState('test-endpoint')).toBe(CircuitState.OPEN);

      // Wait less than cooldown
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(customBreaker.canAttempt('test-endpoint')).toBe(false);

      // Wait for cooldown to complete
      await new Promise(resolve => setTimeout(resolve, 300)); // Total: 600ms
      expect(customBreaker.canAttempt('test-endpoint')).toBe(true);
      expect(customBreaker.getState('test-endpoint')).toBe(CircuitState.HALF_OPEN);
    });

    test('uses default configuration when none provided', () => {
      const defaultBreaker = new CircuitBreaker();

      // Should use defaults: failureThreshold=3, cooldownMs=60000
      defaultBreaker.recordFailure('test-endpoint');
      defaultBreaker.recordFailure('test-endpoint');
      expect(defaultBreaker.getState('test-endpoint')).toBe(CircuitState.CLOSED);

      defaultBreaker.recordFailure('test-endpoint');
      expect(defaultBreaker.getState('test-endpoint')).toBe(CircuitState.OPEN);
    });
  });
});
