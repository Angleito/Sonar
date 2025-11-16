export type LeaderboardTier = 'Legend' | 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Contributor';

export interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  username: string;
  total_points: number;
  total_submissions: number;
  average_rarity_score: number;
  tier: LeaderboardTier;
  first_bulk_contributions: number;
  rare_subject_contributions: number;
}

export interface TierProgress {
  current_tier: LeaderboardTier;
  next_tier: LeaderboardTier | null;
  points_needed: number;
  progress_percent: number;
}

export interface UserRankInfo extends LeaderboardEntry {
  tier_progress: TierProgress;
}

export interface LeaderboardFilter {
  tier?: LeaderboardTier;
  limit?: number;
  offset?: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
}
