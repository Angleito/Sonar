'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { SignalBadge } from '@/components/ui/SignalBadge';
import { formatSonarAmount } from '@/lib/tier-utils';
import { cn } from '@/lib/utils';
import type { TierInfo } from '@/lib/tier-utils';
import type { ProtocolStats } from '@/types/blockchain';

interface TierCardProps {
  tier: TierInfo;
  stats: ProtocolStats;
  highlighted?: boolean;
}

/**
 * TierCard Component
 * Displays tier information with burn rate, thresholds, and current status
 */
export function TierCard({ tier, stats, highlighted = false }: TierCardProps) {
  const isCurrentTier = highlighted;

  return (
    <GlassCard
      className={cn(
        'relative overflow-hidden transition-all',
        isCurrentTier && 'sonar-glow ring-2 ring-sonar-signal/50'
      )}
      glow={isCurrentTier}
    >
      {/* Tier Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold text-2xl',
              tier.level === 1 && 'bg-sonar-coral/20 text-sonar-coral',
              tier.level === 2 && 'bg-sonar-signal/20 text-sonar-signal',
              tier.level === 3 && 'bg-sonar-highlight/20 text-sonar-highlight'
            )}
          >
            {tier.level}
          </div>
          <div>
            <h3 className="text-xl font-mono text-sonar-highlight">Tier {tier.level}</h3>
            <p className="text-sm text-sonar-highlight-bright/60">{tier.description}</p>
          </div>
        </div>

        {isCurrentTier && (
          <SignalBadge variant="success" className="text-xs">
            ACTIVE
          </SignalBadge>
        )}
      </div>

      {/* Burn Rate - Large Display */}
      <div className="mb-6 text-center py-6 bg-sonar-abyss/30 rounded-sonar border border-white/5">
        <div className={cn('text-5xl font-mono font-bold mb-2', tier.color)}>
          {(tier.burnRate * 100).toFixed(0)}%
        </div>
        <div className="text-sm text-sonar-highlight-bright/60 uppercase tracking-wide">
          Burn Rate
        </div>
      </div>

      {/* Thresholds */}
      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-white/5">
          <span className="text-sm text-sonar-highlight-bright/70">Minimum Supply</span>
          <span className="text-sm font-mono text-sonar-highlight">
            {formatSonarAmount(tier.minThreshold)}
          </span>
        </div>

        {tier.nextThreshold && (
          <div className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-sm text-sonar-highlight-bright/70">Next Tier Threshold</span>
            <span className="text-sm font-mono text-sonar-highlight">
              {formatSonarAmount(tier.nextThreshold)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-sonar-highlight-bright/70">Creator Reward</span>
          <span className="text-sm font-mono text-sonar-highlight">
            {((1 - tier.burnRate) * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Progress Bar (only for current tier) */}
      {isCurrentTier && tier.nextThreshold && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-sonar-highlight-bright/60">Progress to Next Tier</span>
            <span className="text-xs font-mono text-sonar-highlight">{tier.progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-sonar-abyss/50 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500 rounded-full',
                tier.level === 1 && 'bg-sonar-coral',
                tier.level === 2 && 'bg-sonar-signal',
                tier.level === 3 && 'bg-sonar-highlight'
              )}
              style={{ width: `${Math.min(100, Math.max(0, tier.progress))}%` }}
            />
          </div>
        </div>
      )}
    </GlassCard>
  );
}
