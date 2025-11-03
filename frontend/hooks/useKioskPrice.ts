/**
 * Hook for fetching kiosk liquidity price and status
 * Polls every 30 seconds for live price updates
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getKioskPrice, getKioskStatus } from '@/lib/api/client';
import { deriveKioskMetrics } from '@/lib/kiosk/metrics';

export function useKioskPrice() {
  const priceQuery = useQuery({
    queryKey: ['kiosk-price'],
    queryFn: getKioskPrice,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const statusQuery = useQuery({
    queryKey: ['kiosk-status'],
    queryFn: getKioskStatus,
    staleTime: 60 * 1000, // 60 seconds for status
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Auto-refresh price every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void priceQuery.refetch();
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [priceQuery.refetch]);

  const statusError = statusQuery.error as Error | null;
  const priceError = priceQuery.error as Error | null;

  const metrics = deriveKioskMetrics(priceQuery.data, statusQuery.data);

  const circulatingSupply = metrics.circulatingSupply
    ? metrics.circulatingSupply.toString()
    : null;

  const priceOverride = metrics.priceOverride
    ? metrics.priceOverride.toString()
    : null;

  return {
    price: priceQuery.data,
    status: statusQuery.data,
    metrics,
    sonarPriceInSui: metrics.sonarPriceInSui,
    sonarPriceDisplay: metrics.sonarPriceDisplay,
    currentTier: metrics.currentTier,
    circulatingSupply,
    priceOverride,
    overrideActive: metrics.overrideActive,
    lastSyncedAt: metrics.lastSyncedAt,
    sonarReserveBI: metrics.sonarReserve,
    suiReserveBI: metrics.suiReserve,
    isPriceLoading: priceQuery.isLoading,
    isStatusLoading: statusQuery.isLoading,
    priceError,
    statusError,
    refetchPrice: priceQuery.refetch,
    refetchStatus: statusQuery.refetch,
    isLoading: priceQuery.isLoading || statusQuery.isLoading,
    error: priceError ?? statusError,
  };
}
