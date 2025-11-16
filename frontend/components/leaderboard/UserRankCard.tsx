'use client';

import { GlassCard } from '@/components/ui/GlassCard';
import { TierBadge } from './TierBadge';
import type { UserRankInfo } from '@/types/leaderboard';

interface UserRankCardProps {
  userRank: UserRankInfo;
}

export function UserRankCard({ userRank }: UserRankCardProps) {
  return (
    <GlassCard glow className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: User Info */}
        <div>
          <h2 className="text-2xl font-mono font-bold text-sonar-highlight mb-4">Your Rank</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-sonar-highlight-bright/60 mb-1">Rank</p>
              <p className="text-4xl font-mono font-bold text-sonar-signal">#{userRank.rank}</p>
            </div>
            <div>
              <p className="text-sm text-sonar-highlight-bright/60 mb-2">Tier</p>
              <TierBadge tier={userRank.tier} size="lg" />
            </div>
            <div>
              <p className="text-sm text-sonar-highlight-bright/60 mb-1">Username</p>
              <p className="text-lg font-mono text-sonar-highlight">{userRank.username}</p>
            </div>
          </div>
        </div>

        {/* Right: Stats & Progress */}
        <div>
          <div className="space-y-4">
            {/* Points */}
            <div className="bg-sonar-abyss/50 rounded-lg p-4 border border-sonar-signal/20">
              <p className="text-sm text-sonar-highlight-bright/60 mb-1">Total Points</p>
              <p className="text-3xl font-mono font-bold text-sonar-signal">{userRank.total_points.toLocaleString()}</p>
            </div>

            {/* Tier Progress */}
            <div className="bg-sonar-abyss/50 rounded-lg p-4 border border-sonar-signal/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-sonar-highlight-bright/60">Progress to {userRank.tier_progress.next_tier || 'Max'}</p>
                <p className="text-sm font-mono text-sonar-signal">{userRank.tier_progress.progress_percent}%</p>
              </div>
              <div className="w-full bg-sonar-abyss rounded-full h-2 border border-sonar-signal/30">
                <div
                  className="bg-gradient-to-r from-sonar-signal to-sonar-highlight h-full rounded-full"
                  style={{ width: `${userRank.tier_progress.progress_percent}%` }}
                />
              </div>
              {userRank.tier_progress.next_tier && (
                <p className="text-xs text-sonar-highlight-bright/60 mt-2">
                  {userRank.tier_progress.points_needed.toLocaleString()} points needed
                </p>
              )}
            </div>

            {/* Contributions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sonar-abyss/50 rounded-lg p-3 border border-sonar-signal/20">
                <p className="text-xs text-sonar-highlight-bright/60 mb-1">Submissions</p>
                <p className="text-xl font-mono text-sonar-highlight">{userRank.total_submissions}</p>
              </div>
              <div className="bg-sonar-abyss/50 rounded-lg p-3 border border-sonar-signal/20">
                <p className="text-xs text-sonar-highlight-bright/60 mb-1">Avg Rarity</p>
                <p className="text-xl font-mono text-sonar-highlight">{userRank.average_rarity_score.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
