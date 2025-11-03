/**
 * Kiosk Price Card Component
 * Displays current kiosk SONAR price with tier and reserve information
 * Features live 30-second refresh
 */

'use client';

import { useEffect, useState } from 'react';
import { useKioskPrice } from '@/hooks/useKioskPrice';
import { formatBigIntAmount, formatBigIntToMillions } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface KioskPriceCardProps {
  compact?: boolean;
  showReserve?: boolean;
  className?: string;
}

export function KioskPriceCard({
  compact = false,
  showReserve = false,
  className = '',
}: KioskPriceCardProps) {
  const {
    price,
    status,
    metrics,
    isLoading,
    error,
    refetchPrice,
  } =
    useKioskPrice();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchPrice();
    setRefreshing(false);
  };

  if (error) {
    return (
      <div className={`p-3 bg-red-500/10 border border-red-500/30 rounded-lg ${className}`}>
        <p className="text-xs text-red-200">Kiosk unavailable</p>
      </div>
    );
  }

  if (isLoading || !price) {
    return (
      <div className={`p-3 bg-gray-700/50 border border-gray-600/50 rounded-lg animate-pulse ${className}`}>
        <p className="text-xs text-gray-400">Loading price...</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-2 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg ${className}`}>
        <div className="flex-1">
          <p className="text-xs text-gray-400">Kiosk Price</p>
          <p className="text-sm font-bold text-purple-200">
            {metrics.sonarPriceDisplay}
          </p>
        </div>
        <div className="text-right">
          <div className="inline-block px-2 py-1 bg-purple-600/30 border border-purple-500/50 rounded text-xs text-purple-100">
            Tier {metrics.currentTier ?? '?'}
          </div>
          {metrics.overrideActive && (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-yellow-300">
              Override Active
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full card view - use BigInt-safe formatting
  const sonarReserveDisplay = status?.sonar_reserve
    ? formatBigIntToMillions(status.sonar_reserve, 9)
    : '-';

  const suiReserveDisplay = status?.sui_reserve
    ? formatBigIntToMillions(status.sui_reserve, 9)
    : '-';

  const salesDisplay = status?.last_24h_sales
    ? formatBigIntToMillions(status.last_24h_sales.sonar_sold, 9)
    : '-';

  const sonarPriceDisplay = metrics.sonarPriceDisplay;
  const priceOverrideDisplay = metrics.priceOverrideDisplay;
  const perkTier = metrics.currentTier ?? '?';
  const circulatingSupplyDisplay = metrics.circulatingSupply
    ? formatBigIntAmount(metrics.circulatingSupply, 9, 2)
    : null;
  const usdEstimate = metrics.sonarPriceInSui ? (metrics.sonarPriceInSui * 0.1).toFixed(4) : '0.0000';

  return (
    <div
      className={`p-4 border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg ${className}`}
    >
      {/* Header with refresh */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-purple-100">Kiosk Liquidity</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          className="p-1 text-gray-400 hover:text-purple-300 disabled:opacity-50 transition"
          title="Refresh prices"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Price row */}
      <div className="mb-3 p-3 bg-gray-800/30 border border-gray-700/30 rounded">
        <p className="text-xs text-gray-400 mb-1">SONAR Price</p>
        <div className="flex items-end justify-between">
          <p className="text-lg font-bold text-purple-200">
            {sonarPriceDisplay}
          </p>
          <div className="text-xs text-gray-500">
            ${usdEstimate}
          </div>
        </div>
        {metrics.overrideActive && priceOverrideDisplay && (
          <p className="mt-2 text-xs text-yellow-300">
            Admin override price:{' '}
            {priceOverrideDisplay}
          </p>
        )}
      </div>

      {/* Tier indicator */}
      <div className="mb-3 inline-block px-3 py-1 bg-purple-600/30 border border-purple-500/50 rounded text-xs text-purple-100">
        Economic Tier: {perkTier}
        {typeof metrics.currentTier === 'number' && tierDescription(metrics.currentTier)}
      </div>

      {circulatingSupplyDisplay && (
        <div className="text-xs text-gray-400 mb-3">
          Circulating Supply:{' '}
          {circulatingSupplyDisplay} SONAR
        </div>
      )}

      {/* Reserves (if requested) */}
      {showReserve && (
        <div className="mt-3 pt-3 border-t border-gray-700/30 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">SONAR Reserve:</span>
            <span className="text-gray-100">{sonarReserveDisplay}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">SUI Reserve:</span>
            <span className="text-gray-100">{suiReserveDisplay}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">24h Sales:</span>
            <span className="text-gray-100">{salesDisplay} SONAR</span>
          </div>
        </div>
      )}

      {/* Last updated info */}
      <p className="mt-3 text-xs text-gray-500">
        Updates every 30 seconds
        {metrics.lastSyncedAt && ` • Synced ${new Date(metrics.lastSyncedAt).toLocaleTimeString()}`}
      </p>
    </div>
  );
}

/**
 * Compact inline price indicator
 */
export function KioskPriceBadge() {
  const { metrics, isLoading } = useKioskPrice();

  if (isLoading || !metrics.sonarPriceInSui) {
    return (
      <span className="inline-block px-2 py-0.5 bg-gray-700/50 border border-gray-600/50 rounded text-xs text-gray-400">
        -
      </span>
    );
  }

  return (
    <span className="inline-block px-2 py-0.5 bg-purple-600/30 border border-purple-500/50 rounded text-xs text-purple-200">
      {metrics.sonarPriceInSui.toFixed(3)} SUI
    </span>
  );
}

/**
 * Helper to show tier pricing
 */
function tierDescription(tier: number): string {
  const tiers: Record<number, string> = {
    1: ' - Premium pricing',
    2: ' - Standard pricing',
    3: ' - Discounted pricing',
    4: ' - Clearance pricing',
  };
  return tiers[tier] || '';
}
