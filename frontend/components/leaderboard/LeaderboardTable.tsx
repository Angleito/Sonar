'use client';

import { TierBadge } from './TierBadge';
import type { LeaderboardEntry } from '@/types/leaderboard';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  isLoading?: boolean;
}

export function LeaderboardTable({ entries, isLoading }: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-16 bg-sonar-deep/30 rounded-lg animate-pulse border border-sonar-signal/10" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 border border-sonar-signal/20 rounded-lg">
        <p className="text-sonar-highlight-bright/60">No entries found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-sonar-signal/20">
            <th className="text-left py-3 px-4 text-sm font-mono text-sonar-highlight-bright/70">Rank</th>
            <th className="text-left py-3 px-4 text-sm font-mono text-sonar-highlight-bright/70">User</th>
            <th className="text-right py-3 px-4 text-sm font-mono text-sonar-highlight-bright/70">Points</th>
            <th className="text-right py-3 px-4 text-sm font-mono text-sonar-highlight-bright/70">Submissions</th>
            <th className="text-right py-3 px-4 text-sm font-mono text-sonar-highlight-bright/70">Avg Rarity</th>
            <th className="text-center py-3 px-4 text-sm font-mono text-sonar-highlight-bright/70">Tier</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.wallet_address} className="border-b border-sonar-signal/10 hover:bg-sonar-deep/20 transition">
              <td className="py-4 px-4">
                <span className="text-lg font-mono font-bold text-sonar-signal">#{entry.rank}</span>
              </td>
              <td className="py-4 px-4">
                <div>
                  <p className="font-mono text-sonar-highlight">{entry.username}</p>
                  <p className="text-xs text-sonar-highlight-bright/50 font-mono">{entry.wallet_address.slice(0, 10)}...</p>
                </div>
              </td>
              <td className="py-4 px-4 text-right">
                <span className="font-mono text-sonar-highlight">{entry.total_points.toLocaleString()}</span>
              </td>
              <td className="py-4 px-4 text-right">
                <span className="font-mono text-sonar-highlight-bright/80">{entry.total_submissions}</span>
              </td>
              <td className="py-4 px-4 text-right">
                <span className="font-mono text-sonar-highlight-bright/80">{entry.average_rarity_score.toFixed(2)}</span>
              </td>
              <td className="py-4 px-4 text-center">
                <TierBadge tier={entry.tier} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
