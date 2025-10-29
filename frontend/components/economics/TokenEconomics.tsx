'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { formatNumber } from '@/lib/utils';
import { formatSonarAmount } from '@/lib/tier-utils';
import type { TierInfo } from '@/lib/tier-utils';
import type { ProtocolStats } from '@/types/blockchain';

interface TokenEconomicsProps {
  stats: ProtocolStats;
  currentTier: TierInfo;
}

/**
 * TokenEconomics Component
 * Displays token distribution, burn mechanics, and economic flow
 */
export function TokenEconomics({ stats, currentTier }: TokenEconomicsProps) {
  // Calculate derived metrics
  const totalBurnedPercent = (Number(stats.total_burned) / Number(stats.initial_supply)) * 100;
  const circulatingPercent =
    (Number(stats.circulating_supply) / Number(stats.initial_supply)) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Token Distribution */}
      <GlassCard>
        <h3 className="text-xl font-mono text-sonar-highlight mb-6">Token Distribution</h3>

        <div className="space-y-4">
          {/* Initial Supply */}
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-sonar-highlight-bright/70">Initial Supply</span>
            <span className="text-lg font-mono text-sonar-highlight">
              {formatSonarAmount(Number(stats.initial_supply))}
            </span>
          </div>

          {/* Circulating Supply */}
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-sonar-highlight-bright/70">Circulating Supply</span>
            <div className="text-right">
              <div className="text-lg font-mono text-sonar-signal">
                {formatSonarAmount(Number(stats.circulating_supply))}
              </div>
              <div className="text-xs text-sonar-highlight-bright/50">
                {circulatingPercent.toFixed(2)}% of initial
              </div>
            </div>
          </div>

          {/* Total Burned */}
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-sonar-highlight-bright/70">Total Burned</span>
            <div className="text-right">
              <div className="text-lg font-mono text-sonar-coral">
                {formatSonarAmount(Number(stats.total_burned))}
              </div>
              <div className="text-xs text-sonar-highlight-bright/50">
                {totalBurnedPercent.toFixed(2)}% of initial
              </div>
            </div>
          </div>

          {/* Visual Distribution Bar */}
          <div className="pt-4">
            <div className="text-xs text-sonar-highlight-bright/60 mb-2">Distribution</div>
            <div className="w-full h-8 bg-sonar-abyss/50 rounded-sonar overflow-hidden flex">
              <div
                className="bg-sonar-signal h-full flex items-center justify-center text-xs font-mono"
                style={{ width: `${circulatingPercent}%` }}
                title={`Circulating: ${circulatingPercent.toFixed(1)}%`}
              >
                {circulatingPercent > 15 && `${circulatingPercent.toFixed(0)}%`}
              </div>
              <div
                className="bg-sonar-coral h-full flex items-center justify-center text-xs font-mono"
                style={{ width: `${totalBurnedPercent}%` }}
                title={`Burned: ${totalBurnedPercent.toFixed(1)}%`}
              >
                {totalBurnedPercent > 15 && `${totalBurnedPercent.toFixed(0)}%`}
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-sonar-highlight-bright/50">
              <span className="flex items-center">
                <span className="w-3 h-3 bg-sonar-signal rounded-sm mr-1" /> Circulating
              </span>
              <span className="flex items-center">
                <span className="w-3 h-3 bg-sonar-coral rounded-sm mr-1" /> Burned
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Burn Mechanics */}
      <GlassCard>
        <h3 className="text-xl font-mono text-sonar-highlight mb-6">Burn Mechanics</h3>

        <div className="space-y-4">
          {/* Current Burn Rate */}
          <div className="py-4 bg-sonar-abyss/30 rounded-sonar text-center border border-white/5">
            <div className={`text-4xl font-mono font-bold mb-2 ${currentTier.color}`}>
              {(currentTier.burnRate * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-sonar-highlight-bright/60">Current Burn Rate</div>
          </div>

          {/* Purchase Economics Example */}
          <div className="space-y-3 pt-4">
            <div className="text-sm text-sonar-highlight-bright/70 mb-3">
              For a 100 SONAR purchase at current tier:
            </div>

            <div className="flex justify-between items-center py-3 bg-sonar-abyss/20 rounded-sonar px-4">
              <span className="text-sm text-sonar-highlight-bright/70">Tokens Burned</span>
              <span className="text-sm font-mono text-sonar-coral">
                {(100 * currentTier.burnRate).toFixed(1)} SONAR
              </span>
            </div>

            <div className="flex justify-between items-center py-3 bg-sonar-abyss/20 rounded-sonar px-4">
              <span className="text-sm text-sonar-highlight-bright/70">Creator Receives</span>
              <span className="text-sm font-mono text-sonar-highlight">
                {(100 * (1 - currentTier.burnRate)).toFixed(1)} SONAR
              </span>
            </div>
          </div>

          {/* Burn Trigger */}
          <div className="pt-4 border-t border-white/5">
            <div className="text-xs text-sonar-highlight-bright/60 mb-2">Burn Trigger</div>
            <p className="text-sm text-sonar-highlight-bright/70">
              Every dataset purchase automatically burns tokens according to the current tier rate.
              Burns are permanent and reduce circulating supply.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Protocol Activity */}
      <GlassCard className="md:col-span-2">
        <h3 className="text-xl font-mono text-sonar-highlight mb-6">Protocol Activity</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-sonar-signal mb-2">
              {formatNumber(stats.total_datasets)}
            </div>
            <div className="text-sm text-sonar-highlight-bright/60">Total Datasets</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-sonar-highlight mb-2">
              {formatNumber(stats.total_purchases)}
            </div>
            <div className="text-sm text-sonar-highlight-bright/60">Total Purchases</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-sonar-highlight mb-2">
              {formatNumber(stats.active_creators)}
            </div>
            <div className="text-sm text-sonar-highlight-bright/60">Active Creators</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-sonar-coral mb-2">
              {formatSonarAmount(Number(stats.total_volume))}
            </div>
            <div className="text-sm text-sonar-highlight-bright/60">Total Volume</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
