import type { Dataset, ProtocolStats, DatasetFilter, PaginatedResponse } from '@/types/blockchain';
import type { LeaderboardResponse, UserRankInfo, LeaderboardFilter, LeaderboardEntry } from '@/types/leaderboard';
import { DataRepository, parseDataset, parseProtocolStats } from './repository';
import seedData from '@/data/seed.json';

/**
 * Seed Data Repository
 * Uses local JSON file for development before blockchain integration
 * ESM-compatible import with type assertion
 */
export class SeedDataRepository implements DataRepository {
  private data = seedData;

  async getDatasets(filter?: DatasetFilter): Promise<Dataset[]> {
    let datasets = this.data.datasets.map(parseDataset);

    if (!filter) return datasets;

    // Apply filters
    if (filter.media_type) {
      datasets = datasets.filter(d => d.media_type === filter.media_type);
    }

    if (filter.languages && filter.languages.length > 0) {
      datasets = datasets.filter(d =>
        filter.languages!.some(lang => d.languages.includes(lang))
      );
    }

    if (filter.formats && filter.formats.length > 0) {
      datasets = datasets.filter(d =>
        filter.formats!.some(format => d.formats.includes(format))
      );
    }

    if (filter.min_quality !== undefined) {
      datasets = datasets.filter(d => d.quality_score >= filter.min_quality!);
    }

    if (filter.max_price !== undefined) {
      datasets = datasets.filter(d => d.price <= filter.max_price!);
    }

    if (filter.creator) {
      datasets = datasets.filter(d => d.creator === filter.creator);
    }

    return datasets;
  }

  async getDataset(id: string): Promise<Dataset> {
    const dataset = this.data.datasets.find(d => d.id === id);
    if (!dataset) {
      throw new Error(`Dataset not found: ${id}`);
    }
    return parseDataset(dataset);
  }

  async getStats(): Promise<ProtocolStats> {
    return parseProtocolStats(this.data.stats);
  }

  async getDatasetsPaginated(
    filter?: DatasetFilter,
    cursor?: string
  ): Promise<PaginatedResponse<Dataset>> {
    const allDatasets = await this.getDatasets(filter);
    const pageSize = 12;

    let startIndex = 0;
    if (cursor) {
      startIndex = parseInt(cursor, 10);
    }

    const endIndex = startIndex + pageSize;
    const data = allDatasets.slice(startIndex, endIndex);
    const hasMore = endIndex < allDatasets.length;
    const nextCursor = hasMore ? endIndex.toString() : undefined;

    return {
      data,
      cursor: nextCursor,
      hasMore,
    };
  }

  async getLeaderboard(filter?: LeaderboardFilter): Promise<LeaderboardResponse> {
    const mockLeaderboard: LeaderboardEntry[] = [
      {
        rank: 1,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        username: 'SoundMaster',
        total_points: 125000,
        total_submissions: 450,
        average_rarity_score: 8.5,
        tier: 'Legend',
        first_bulk_contributions: 12,
        rare_subject_contributions: 89,
      },
      {
        rank: 2,
        wallet_address: '0x2345678901bcdef2345678901bcdef2345678901',
        username: 'AudioWizard',
        total_points: 87500,
        total_submissions: 320,
        average_rarity_score: 7.8,
        tier: 'Diamond',
        first_bulk_contributions: 8,
        rare_subject_contributions: 65,
      },
      {
        rank: 3,
        wallet_address: '0x3456789012cdef3456789012cdef3456789012cd',
        username: 'VoiceCollector',
        total_points: 62000,
        total_submissions: 280,
        average_rarity_score: 7.2,
        tier: 'Platinum',
        first_bulk_contributions: 5,
        rare_subject_contributions: 42,
      },
    ];

    let filtered = mockLeaderboard;
    if (filter?.tier) {
      filtered = filtered.filter(e => e.tier === filter.tier);
    }

    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;
    const paged = filtered.slice(offset, offset + limit);

    return {
      entries: paged,
      total: filtered.length,
      limit,
      offset,
    };
  }

  async getUserRank(walletAddress: string): Promise<UserRankInfo | null> {
    const userRankData: UserRankInfo = {
      rank: 25,
      wallet_address: walletAddress,
      username: 'YourUsername',
      total_points: 35000,
      total_submissions: 150,
      average_rarity_score: 6.5,
      tier: 'Gold',
      first_bulk_contributions: 3,
      rare_subject_contributions: 18,
      tier_progress: {
        current_tier: 'Gold',
        next_tier: 'Platinum',
        points_needed: 25000 - 35000 + 25000,
        progress_percent: 40,
      },
    };

    return userRankData;
  }

  async searchLeaderboard(query: string, limit: number = 20): Promise<LeaderboardEntry[]> {
    const mockResults: LeaderboardEntry[] = [
      {
        rank: 1,
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        username: 'SoundMaster',
        total_points: 125000,
        total_submissions: 450,
        average_rarity_score: 8.5,
        tier: 'Legend',
        first_bulk_contributions: 12,
        rare_subject_contributions: 89,
      },
    ];

    return mockResults.filter(
      e =>
        e.username.toLowerCase().includes(query.toLowerCase()) ||
        e.wallet_address.includes(query)
    );
  }
}
