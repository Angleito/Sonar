'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useLeaderboardSearch } from '@/hooks/useLeaderboard';
import { LeaderboardTable } from './LeaderboardTable';

interface LeaderboardSearchProps {
  onClose?: () => void;
}

export function LeaderboardSearch({ onClose }: LeaderboardSearchProps) {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useLeaderboardSearch(query, query.length > 0);

  const handleSearch = (value: string) => {
    setQuery(value);
  };

  return (
    <GlassCard>
      <h3 className="text-lg font-mono font-bold text-sonar-highlight mb-4">Search Leaderboard</h3>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by username or wallet..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-4 py-3 bg-sonar-abyss/50 border border-sonar-signal/30 rounded-lg font-mono text-sonar-highlight placeholder-sonar-highlight-bright/40 focus:outline-none focus:border-sonar-signal focus:ring-2 focus:ring-sonar-signal/20"
        />
      </div>

      {query && (
        <div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-12 bg-sonar-deep/30 rounded-lg animate-pulse" />
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-2">
              {results.map((entry) => (
                <div key={entry.wallet_address} className="p-3 bg-sonar-abyss/30 border border-sonar-signal/20 rounded-lg hover:border-sonar-signal/40 transition cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sonar-highlight">{entry.username}</p>
                      <p className="text-xs text-sonar-highlight-bright/50 font-mono">{entry.wallet_address.slice(0, 16)}...</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-sonar-signal">#{entry.rank}</p>
                      <p className="text-sm font-mono text-sonar-highlight-bright/60">{entry.total_points.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-sonar-highlight-bright/60">No results found</p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
