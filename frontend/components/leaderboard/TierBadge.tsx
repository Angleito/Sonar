import type { LeaderboardTier } from '@/types/leaderboard';
import { SignalBadge } from '@/components/ui/SignalBadge';

const TIER_COLORS: Record<LeaderboardTier, string> = {
  Legend: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Diamond: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Gold: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Silver: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  Bronze: 'bg-amber-700/20 text-amber-600 border-amber-700/30',
  Contributor: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
};

interface TierBadgeProps {
  tier: LeaderboardTier;
  size?: 'sm' | 'md' | 'lg';
}

export function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg border font-mono font-semibold ${TIER_COLORS[tier]}`}>
      {tier}
    </div>
  );
}
