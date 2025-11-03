import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with clsx
 * Handles conditional classes and deduplicates Tailwind utilities
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format large numbers with appropriate suffix (K, M, B)
 */
export function formatNumber(num: number | bigint | undefined | null): string {
  if (num === undefined || num === null) {
    return '0';
  }

  const n = typeof num === 'bigint' ? Number(num) : num;

  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toString();
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, start: number = 6, end: number = 4): string {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

/**
 * Seeded random number generator for consistent SSR/client renders
 */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * BigInt-safe utilities for handling large token amounts
 * Avoid precision loss by keeping calculations in BigInt
 */

/**
 * Format BigInt amount in base units to human-readable display
 * Uses pure BigInt math to avoid precision loss
 * @param baseUnits - Amount in smallest units (e.g., 1 SONAR = 1e9 base units)
 * @param decimals - Number of decimals in the token (default: 9 for SONAR/SUI)
 * @param displayDecimals - Number of decimals to show (default: 2)
 */
export function formatBigIntAmount(
  baseUnits: bigint | string,
  decimals: number = 9,
  displayDecimals: number = 2
): string {
  if (displayDecimals > decimals) {
    throw new Error(`displayDecimals (${displayDecimals}) cannot exceed decimals (${decimals})`);
  }

  const amount = typeof baseUnits === 'string' ? BigInt(baseUnits) : baseUnits;
  const divisor = 10n ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (displayDecimals === 0) {
    return wholePart.toString();
  }

  // Calculate fractional part with proper rounding
  const fractionalDivisor = 10n ** BigInt(decimals - displayDecimals);
  const roundedFractional = fractionalPart / fractionalDivisor;
  const fractionalStr = roundedFractional.toString().padStart(displayDecimals, '0');

  return `${wholePart}.${fractionalStr}`;
}

/**
 * Format BigInt amount in base units to millions (for reserve display)
 * Uses pure BigInt math to avoid precision loss
 * @param baseUnits - Amount in smallest units
 * @param decimals - Number of decimals in the token (default: 9)
 */
export function formatBigIntToMillions(
  baseUnits: bigint | string,
  decimals: number = 9
): string {
  const amount = typeof baseUnits === 'string' ? BigInt(baseUnits) : baseUnits;
  const oneMillion = 10n ** BigInt(decimals + 6); // 1M tokens = 1e15 base units for 9 decimals
  const millions = amount / oneMillion;
  const fractional = (amount % oneMillion) * 10n / oneMillion;

  if (fractional === 0n) {
    return `${millions}M`;
  }
  return `${millions}.${fractional}M`;
}

/**
 * Calculate tier from SONAR reserve (BigInt-safe)
 * Matches contract tier thresholds
 */
export function calculateTierFromReserve(reserveBaseUnits: bigint): number {
  const ONE_MILLION = 1_000_000n * 10n ** 9n; // 1M SONAR in base units (1e15)
  const reserves = reserveBaseUnits / ONE_MILLION; // Reserve in millions

  if (reserves > 50n) return 1;
  if (reserves > 35n) return 2;
  if (reserves > 20n) return 3;
  return 4;
}

/**
 * Multiply a BigInt amount by a price ratio (both in base units)
 * Used for calculating SUI needed for SONAR purchase
 * IMPORTANT: Rounds UP to ensure sufficient payment (prevents underpayment rejection)
 * @param sonarAmount - Amount of SONAR to buy (base units)
 * @param sonarPriceInSui - Price per SONAR in SUI (base units)
 * @returns SUI needed (base units), rounded up
 */
export function calculateSuiNeeded(
  sonarAmount: bigint,
  sonarPriceInSui: bigint
): bigint {
  // sonarAmount * sonarPriceInSui / 1e9
  // Example: 1000 SONAR (1e12 base) * 0.8 SUI (8e8 base) / 1e9 = 800 SUI (8e11 base)
  // Use ceiling division: (a + b - 1) / b to round up and avoid underpayment
  const ONE_SONAR = 10n ** 9n;
  const product = sonarAmount * sonarPriceInSui;
  return (product + ONE_SONAR - 1n) / ONE_SONAR;
}
