/**
 * Unit tests for BigInt utility functions
 * Run with: bun test lib/__tests__/utils.test.ts
 */

import { describe, test, expect } from 'bun:test';
import {
  formatBigIntAmount,
  formatBigIntToMillions,
  calculateTierFromReserve,
  calculateSuiNeeded,
} from '../utils';

describe('formatBigIntAmount', () => {
  test('formats whole amounts correctly', () => {
    expect(formatBigIntAmount(1_000_000_000n, 9, 2)).toBe('1.00');
    expect(formatBigIntAmount(5_000_000_000n, 9, 2)).toBe('5.00');
  });

  test('formats fractional amounts correctly', () => {
    expect(formatBigIntAmount(1_500_000_000n, 9, 2)).toBe('1.50');
    expect(formatBigIntAmount(123_456_789n, 9, 2)).toBe('0.12');
  });

  test('handles large amounts without precision loss', () => {
    // 50M SONAR = 5e16 base units (exceeds Number.MAX_SAFE_INTEGER)
    const fiftyMillion = 50_000_000n * 10n ** 9n;
    expect(formatBigIntAmount(fiftyMillion, 9, 1)).toBe('50000000.0');
  });

  test('handles zero decimals', () => {
    expect(formatBigIntAmount(1_500_000_000n, 9, 0)).toBe('1');
  });

  test('throws on invalid displayDecimals', () => {
    expect(() => formatBigIntAmount(1000n, 9, 10)).toThrow();
  });

  test('works with string input', () => {
    expect(formatBigIntAmount('1000000000', 9, 2)).toBe('1.00');
  });
});

describe('formatBigIntToMillions', () => {
  test('formats millions correctly', () => {
    const oneMillion = 1_000_000n * 10n ** 9n;
    expect(formatBigIntToMillions(oneMillion, 9)).toBe('1M');
  });

  test('formats fractional millions', () => {
    const onePointFiveMillion = 1_500_000n * 10n ** 9n;
    expect(formatBigIntToMillions(onePointFiveMillion, 9)).toBe('1.5M');
  });

  test('handles large reserves without precision loss', () => {
    const fiftyMillion = 50_000_000n * 10n ** 9n;
    expect(formatBigIntToMillions(fiftyMillion, 9)).toBe('50M');
  });

  test('handles sub-million amounts', () => {
    const halfMillion = 500_000n * 10n ** 9n;
    expect(formatBigIntToMillions(halfMillion, 9)).toBe('0.5M');
  });
});

describe('calculateTierFromReserve', () => {
  test('returns tier 1 for >50M reserves', () => {
    const fiftyOneMillion = 51_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(fiftyOneMillion)).toBe(1);
  });

  test('returns tier 2 for 35-50M reserves', () => {
    const fortyMillion = 40_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(fortyMillion)).toBe(2);
  });

  test('returns tier 3 for 20-35M reserves', () => {
    const thirtyMillion = 30_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(thirtyMillion)).toBe(3);
  });

  test('returns tier 4 for <20M reserves', () => {
    const tenMillion = 10_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(tenMillion)).toBe(4);
  });

  test('handles exact boundary values', () => {
    const exactlyFiftyMillion = 50_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(exactlyFiftyMillion)).toBe(2);

    const exactlyThirtyFiveMillion = 35_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(exactlyThirtyFiveMillion)).toBe(3);

    const exactlyTwentyMillion = 20_000_000n * 10n ** 9n;
    expect(calculateTierFromReserve(exactlyTwentyMillion)).toBe(4);
  });
});

describe('calculateSuiNeeded', () => {
  test('calculates exact amounts when evenly divisible', () => {
    // 1000 SONAR at 1 SUI per SONAR = 1000 SUI
    const sonarAmount = 1000n * 10n ** 9n;
    const pricePerSonar = 1n * 10n ** 9n;
    const result = calculateSuiNeeded(sonarAmount, pricePerSonar);
    expect(result).toBe(1000n * 10n ** 9n);
  });

  test('rounds up fractional amounts to prevent underpayment', () => {
    // 1.5 SONAR at 0.8 SUI per SONAR = 1.2 SUI
    // But with fractional calculation: 1.5e9 * 0.8e9 / 1e9 = 1.2e9
    // Should round UP to ensure we don't underpay
    const sonarAmount = (10n ** 9n) + (5n * 10n ** 8n); // 1.5 SONAR
    const pricePerSonar = 8n * 10n ** 8n; // 0.8 SUI
    const result = calculateSuiNeeded(sonarAmount, pricePerSonar);

    // Expected: 1.5 * 0.8 = 1.2 SUI = 1.2e9 base units
    const expected = 12n * 10n ** 8n;
    expect(result).toBe(expected);
  });

  test('rounds up for fractional nano-SUI', () => {
    // Test case that would truncate without ceiling division
    // 3 SONAR at 0.333333333 SUI per SONAR
    const sonarAmount = 3n * 10n ** 9n;
    const pricePerSonar = 333_333_333n; // 0.333333333 SUI
    const result = calculateSuiNeeded(sonarAmount, pricePerSonar);

    // 3 * 333333333 = 999999999
    // Without ceiling: 999999999 / 1e9 = 0 (truncated!)
    // With ceiling: (999999999 + 1e9 - 1) / 1e9 = 1
    expect(result).toBeGreaterThan(0n);
  });

  test('handles large dataset prices without overflow', () => {
    // 1M SONAR at 0.5 SUI per SONAR = 500k SUI
    const sonarAmount = 1_000_000n * 10n ** 9n;
    const pricePerSonar = 5n * 10n ** 8n; // 0.5 SUI
    const result = calculateSuiNeeded(sonarAmount, pricePerSonar);

    const expected = 500_000n * 10n ** 9n;
    expect(result).toBe(expected);
  });

  test('prevents underpayment on fractional SONAR prices', () => {
    // This is the critical test case from the bug report
    // 1 SONAR dataset at 0.999999999 SUI per SONAR
    const sonarAmount = 1n * 10n ** 9n;
    const pricePerSonar = 999_999_999n;
    const result = calculateSuiNeeded(sonarAmount, pricePerSonar);

    // Without ceiling: 999999999 * 1e9 / 1e9 = 999999999 (underpays by 1!)
    // With ceiling: should be exactly 999999999
    expect(result).toBe(999_999_999n);
  });
});
