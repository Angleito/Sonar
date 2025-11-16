'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import type { LeaderboardTier } from '@/types/leaderboard';

const TIERS: LeaderboardTier[] = ['Legend', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Contributor'];

interface TierFilterProps {
  selectedTier?: LeaderboardTier;
  onTierChange: (tier?: LeaderboardTier) => void;
}

export function TierFilter({ selectedTier, onTierChange }: TierFilterProps) {
  return (
    <GlassCard>
      <h3 className="text-lg font-mono font-bold text-sonar-highlight mb-4">Filter by Tier</h3>

      <div className="space-y-2">
        <button
          onClick={() => onTierChange(undefined)}
          className={`w-full text-left px-4 py-2.5 rounded-lg font-mono text-sm transition ${
            !selectedTier
              ? 'bg-sonar-signal/20 border border-sonar-signal text-sonar-highlight'
              : 'border border-sonar-signal/20 text-sonar-highlight-bright/70 hover:border-sonar-signal/40'
          }`}
        >
          All Tiers
        </button>

        {TIERS.map((tier) => (
          <button
            key={tier}
            onClick={() => onTierChange(tier)}
            className={`w-full text-left px-4 py-2.5 rounded-lg font-mono text-sm transition ${
              selectedTier === tier
                ? 'bg-sonar-signal/20 border border-sonar-signal text-sonar-highlight'
                : 'border border-sonar-signal/20 text-sonar-highlight-bright/70 hover:border-sonar-signal/40'
            }`}
          >
            {tier}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}
