import type { KioskPrice, KioskStatus } from '@/lib/api/client';

export interface KioskMetrics {
  sonarPrice: bigint | null;
  sonarPriceInSui: number | null;
  sonarPriceDisplay: string;
  priceOverride: bigint | null;
  priceOverrideDisplay: string | null;
  overrideActive: boolean;
  currentTier: number | null;
  circulatingSupply: bigint | null;
  lastSyncedAt: string | null;
  sonarReserve: bigint | null;
  suiReserve: bigint | null;
}

export function toBigInt(value: string | number | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  try {
    return typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    return null;
  }
}

export function deriveKioskMetrics(
  price?: KioskPrice | null,
  status?: KioskStatus | null
): KioskMetrics {
  const sonarPrice = toBigInt(price?.sonar_price ?? null);
  const priceOverride = toBigInt(price?.price_override ?? status?.price_override ?? null);
  const overrideActive = Boolean(price?.override_active ?? status?.override_active ?? false);
  const currentTier = price?.current_tier ?? status?.current_tier ?? null;
  const circulatingSupply = toBigInt(price?.circulating_supply ?? status?.circulating_supply ?? null);
  const lastSyncedAt = price?.last_synced_at ?? status?.last_synced_at ?? null;
  const sonarReserve = toBigInt(status?.sonar_reserve);
  const suiReserve = toBigInt(status?.sui_reserve);

  const sonarPriceInSui = sonarPrice ? Number(sonarPrice) / 1e9 : null;
  const sonarPriceDisplay = sonarPriceInSui ? `${sonarPriceInSui.toFixed(3)} SUI` : '-';

  const priceOverrideDisplay = priceOverride
    ? `${(Number(priceOverride) / 1e9).toFixed(3)} SUI`
    : null;

  return {
    sonarPrice,
    sonarPriceInSui,
    sonarPriceDisplay,
    priceOverride,
    priceOverrideDisplay,
    overrideActive,
    currentTier: currentTier ?? null,
    circulatingSupply,
    lastSyncedAt,
    sonarReserve,
    suiReserve,
  };
}
