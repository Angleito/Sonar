'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { formatSonarAmount, TIER_THRESHOLDS } from '@/lib/tier-utils';
import { cn } from '@/lib/utils';
import type { TierInfo } from '@/lib/tier-utils';
import type { ProtocolStats } from '@/types/blockchain';

interface SupplyMetricsProps {
  stats: ProtocolStats;
  currentTier: TierInfo;
}

/**
 * SupplyMetrics Component
 * Displays supply thresholds, tier progress, and scarcity metrics
 */
export function SupplyMetrics({ stats, currentTier }: SupplyMetricsProps) {
  const circulatingSupply = Number(stats.circulating_supply);
  const initialSupply = Number(stats.initial_supply);

  // Calculate progress through entire supply range
  const totalBurnProgress = ((initialSupply - circulatingSupply) / initialSupply) * 100;

  // Tier threshold markers (as percentages of initial supply)
  const tier1Marker = (TIER_THRESHOLDS.TIER_1_MIN / initialSupply) * 100;
  const tier2Marker = (TIER_THRESHOLDS.TIER_2_MIN / initialSupply) * 100;

  return (
    <GlassCard>
      <h3 className="text-xl font-mono text-sonar-highlight mb-6">Supply Journey</h3>

      {/* Current Supply Status */}
      <div className="mb-8">
        <div className="flex justify-between items-baseline mb-4">
          <div>
            <div className="text-sm text-sonar-highlight-bright/60 mb-1">Current Supply</div>
            <div className="text-4xl font-mono font-bold text-sonar-signal">
              {formatSonarAmount(circulatingSupply)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-sonar-highlight-bright/60 mb-1">Initial Supply</div>
            <div className="text-2xl font-mono text-sonar-highlight">
              {formatSonarAmount(initialSupply)}
            </div>
          </div>
        </div>

        {/* Visual Supply Timeline */}
        <div className="relative">
          <div className="text-xs text-sonar-highlight-bright/60 mb-2">Supply Timeline</div>

          {/* Main progress bar */}
          <div className="relative w-full h-12 bg-sonar-abyss/50 rounded-sonar overflow-hidden">
            {/* Burned portion (from right to left) */}
            <div
              className="absolute right-0 top-0 h-full bg-gradient-to-l from-sonar-coral/40 to-sonar-coral/10"
              style={{ width: `${totalBurnProgress}%` }}
            />

            {/* Current position marker */}
            <div
              className="absolute top-0 h-full w-1 bg-sonar-signal"
              style={{
                left: `${((circulatingSupply / initialSupply) * 100)}%`,
              }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-mono text-sonar-signal whitespace-nowrap">
                YOU ARE HERE
              </div>
            </div>

            {/* Tier 1 threshold */}
            <div
              className="absolute top-0 h-full w-0.5 bg-sonar-highlight/50"
              style={{ left: `${tier1Marker}%` }}
            >
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-mono text-sonar-highlight/70 whitespace-nowrap">
                T1
              </div>
            </div>

            {/* Tier 2 threshold */}
            <div
              className="absolute top-0 h-full w-0.5 bg-sonar-highlight/50"
              style={{ left: `${tier2Marker}%` }}
            >
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-mono text-sonar-highlight/70 whitespace-nowrap">
                T2
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-between items-center mt-8 text-xs">
            <span className="text-sonar-highlight-bright/50">
              0 SONAR <span className="text-sonar-highlight/70">(Max Scarcity)</span>
            </span>
            <span className="text-sonar-highlight-bright/50">
              {formatSonarAmount(initialSupply)}{' '}
              <span className="text-sonar-highlight/70">(Initial)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tier Thresholds */}
      <div className="space-y-3 pt-6 border-t border-white/5">
        <h4 className="text-sm font-mono text-sonar-highlight-bright/70 mb-4">
          Tier Thresholds
        </h4>

        {/* Tier 1 */}
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-sonar-coral/20 text-sonar-coral flex items-center justify-center text-sm font-mono font-bold">
              1
            </div>
            <span className="text-sm text-sonar-highlight-bright/70">High Supply</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-sonar-highlight">
              ≥ {formatSonarAmount(TIER_THRESHOLDS.TIER_1_MIN)}
            </div>
            <div className="text-xs text-sonar-highlight-bright/50">60% burn rate</div>
          </div>
        </div>

        {/* Tier 2 */}
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-sonar-signal/20 text-sonar-signal flex items-center justify-center text-sm font-mono font-bold">
              2
            </div>
            <span className="text-sm text-sonar-highlight-bright/70">Medium Supply</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-sonar-highlight">
              {formatSonarAmount(TIER_THRESHOLDS.TIER_2_MIN)} -{' '}
              {formatSonarAmount(TIER_THRESHOLDS.TIER_1_MIN)}
            </div>
            <div className="text-xs text-sonar-highlight-bright/50">45% burn rate</div>
          </div>
        </div>

        {/* Tier 3 */}
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-sonar-highlight/20 text-sonar-highlight flex items-center justify-center text-sm font-mono font-bold">
              3
            </div>
            <span className="text-sm text-sonar-highlight-bright/70">Low Supply</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-sonar-highlight">
              &lt; {formatSonarAmount(TIER_THRESHOLDS.TIER_2_MIN)}
            </div>
            <div className="text-xs text-sonar-highlight-bright/50">20% burn rate</div>
          </div>
        </div>
      </div>

      {/* Scarcity Protection Note */}
      {currentTier.level === 3 && (
        <div className="mt-6 p-4 bg-sonar-highlight/10 rounded-sonar border border-sonar-highlight/30">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">🛡️</div>
            <div>
              <div className="text-sm font-mono text-sonar-highlight mb-1">Scarcity Protection Active</div>
              <div className="text-xs text-sonar-highlight-bright/70">
                The protocol has entered Tier 3 with reduced burn rates to preserve token scarcity
                and ensure long-term sustainability.
              </div>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
