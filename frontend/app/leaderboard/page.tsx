'use client';

import { useState } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { useLeaderboard, useUserRank } from '@/hooks/useLeaderboard';
import { SonarBackground } from '@/components/animations/SonarBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TierFilter } from '@/components/leaderboard/TierFilter';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { UserRankCard } from '@/components/leaderboard/UserRankCard';
import { LeaderboardSearch } from '@/components/leaderboard/LeaderboardSearch';
import type { LeaderboardTier } from '@/types/leaderboard';

export default function LeaderboardPage() {
  const { currentAccount } = useWallet();
  const [selectedTier, setSelectedTier] = useState<LeaderboardTier | undefined>();
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading: leaderboardLoading } = useLeaderboard({
    tier: selectedTier,
    limit: pageSize,
    offset: currentPage * pageSize,
  });

  // Fetch user rank if authenticated
  const { data: userRank, isLoading: userRankLoading } = useUserRank(currentAccount?.address || null);

  const handleTierChange = (tier?: LeaderboardTier) => {
    setSelectedTier(tier);
    setCurrentPage(0);
  };

  return (
    <main className="relative min-h-screen">
      {/* Background Animation */}
      <SonarBackground opacity={0.2} intensity={0.5} />

      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="max-w-6xl mx-auto mb-12">
          <h1 className="text-5xl font-mono tracking-radar text-sonar-highlight mb-4">
            Leaderboard
          </h1>
          <p className="text-xl text-sonar-highlight-bright/80">
            Top contributors ranked by points and tier progression
          </p>
        </div>

        {/* User Rank Card (if authenticated) */}
        {currentAccount && (
          <>
            {userRankLoading ? (
              <div className="max-w-6xl mx-auto mb-8">
                <div className="h-48 bg-sonar-deep/30 rounded-lg animate-pulse border border-sonar-signal/10" />
              </div>
            ) : userRank ? (
              <div className="max-w-6xl mx-auto mb-8">
                <UserRankCard userRank={userRank} />
              </div>
            ) : null}
          </>
        )}

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar: Filters and Search */}
            <aside className="lg:col-span-1 space-y-6">
              <TierFilter selectedTier={selectedTier} onTierChange={handleTierChange} />
              <LeaderboardSearch />
            </aside>

            {/* Main: Leaderboard Table */}
            <div className="lg:col-span-3">
              <GlassCard glow>
                {leaderboardLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <>
                    <LeaderboardTable entries={leaderboardData?.entries || []} isLoading={leaderboardLoading} />

                    {/* Pagination Info */}
                    {leaderboardData && leaderboardData.total > 0 && (
                      <div className="mt-6 pt-6 border-t border-sonar-signal/20">
                        <div className="flex items-center justify-between text-sm text-sonar-highlight-bright/60 font-mono">
                          <p>
                            Showing {currentPage * pageSize + 1} to{' '}
                            {Math.min((currentPage + 1) * pageSize, leaderboardData.total)} of {leaderboardData.total}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                              disabled={currentPage === 0}
                              className="px-4 py-2 bg-sonar-signal/10 border border-sonar-signal/30 rounded-lg text-sonar-highlight hover:bg-sonar-signal/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() =>
                                setCurrentPage(
                                  Math.min(Math.ceil(leaderboardData.total / pageSize) - 1, currentPage + 1)
                                )
                              }
                              disabled={(currentPage + 1) * pageSize >= leaderboardData.total}
                              className="px-4 py-2 bg-sonar-signal/10 border border-sonar-signal/30 rounded-lg text-sonar-highlight hover:bg-sonar-signal/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </GlassCard>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
