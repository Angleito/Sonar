'use client';

import { useQuery } from '@tanstack/react-query';
import { useRepository } from '@/providers/repository-provider';
import type { LeaderboardFilter, UserRankInfo, LeaderboardEntry } from '@/types/leaderboard';

/**
 * Hook to fetch global leaderboard
 */
export function useLeaderboard(filter?: LeaderboardFilter) {
  const repository = useRepository();

  return useQuery({
    queryKey: ['leaderboard', filter],
    queryFn: () => repository.getLeaderboard(filter),
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Poll every minute
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch user's rank and tier progress
 */
export function useUserRank(walletAddress: string | null) {
  const repository = useRepository();

  return useQuery({
    queryKey: ['userRank', walletAddress],
    queryFn: () => (walletAddress ? repository.getUserRank(walletAddress) : null),
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Poll every minute
    refetchOnWindowFocus: true,
    enabled: !!walletAddress,
  });
}

/**
 * Hook to search leaderboard
 */
export function useLeaderboardSearch(query: string, enabled: boolean = true) {
  const repository = useRepository();

  return useQuery({
    queryKey: ['leaderboardSearch', query],
    queryFn: () => (query.trim() ? repository.searchLeaderboard(query) : Promise.resolve([])),
    staleTime: 30_000,
    enabled: enabled && query.trim().length > 0,
  });
}
